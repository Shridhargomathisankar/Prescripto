import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { api } from '../config/api';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'prescripto_auth_v1';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.role && parsed?.user) {
        return { role: parsed.role, ...parsed.user };
      }
    } catch {}
    return null;
  });

  const [firebaseToken, setFirebaseToken] = useState(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.idToken || null;
    } catch {}
    return null;
  });

  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ======================
     Local storage helpers
     ====================== */
  const writeStoredAuth = useCallback((role, userObj, idToken) => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ role, user: userObj, idToken, updatedAt: Date.now() })
    );
  }, []);

  const readStoredAuth = useCallback(() => {
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.role || !parsed?.user) return null;
      return parsed;
    } catch {
      return null;
    }
  }, []);

  const clearStoredAuth = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  const persistAuth = useCallback(
    (role, userObj, idToken) => {
      if (!role || !userObj) return;
      setUser({ role, ...userObj });
      if (idToken) setFirebaseToken(idToken);
      writeStoredAuth(role, userObj, idToken);
    },
    [writeStoredAuth]
  );

  /* ======================
     Restore auth on refresh
     ====================== */
  useEffect(() => {
    const stored = readStoredAuth();
    if (stored) {
      setUser({ role: stored.role, ...stored.user });
      if (stored.idToken) setFirebaseToken(stored.idToken);
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        const storedAuth = readStoredAuth();
        if (storedAuth) {
          if (storedAuth.idToken) {
            try {
              const res = await api.auth.verify(storedAuth.idToken);
              if (res && res.user) {
                persistAuth(res.role || storedAuth.role, res.user, storedAuth.idToken);
              } else {
                setUser({ role: storedAuth.role, ...storedAuth.user });
                setFirebaseToken(storedAuth.idToken);
              }
            } catch (err) {
              if (err?.status === 401) {
                setUser(null);
                setFirebaseToken(null);
                clearStoredAuth();
              } else {
                setUser({ role: storedAuth.role, ...storedAuth.user });
                setFirebaseToken(storedAuth.idToken);
              }
            }
          } else {
            setUser({ role: storedAuth.role, ...storedAuth.user });
          }
        } else {
          setUser(null);
          setFirebaseToken(null);
          clearStoredAuth();
        }
        setAuthReady(true);
        return;
      }

      try {
        const idToken = await firebaseUser.getIdToken(true);
        setFirebaseToken(idToken);

        const res = await api.auth.verify(idToken);

        if (res.role === 'patient') {
          persistAuth('patient', res.user, idToken);
        } else if (res.role === 'doctor') {
          persistAuth('doctor', res.user, idToken);
        } else if (res.role === 'pharmacy') {
          persistAuth('pharmacy', res.user, idToken);
        } else {
          const storedAuth = readStoredAuth();
          if (storedAuth) {
            persistAuth(storedAuth.role, storedAuth.user, idToken);
          }
        }
      } catch (err) {
        if (err?.status === 401) {
          clearStoredAuth();
          setUser(null);
          setFirebaseToken(null);
        }
      } finally {
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, [persistAuth, readStoredAuth, clearStoredAuth]);

  /* ======================
     Recaptcha + OTP
     ====================== */
  const setupRecaptcha = useCallback((containerId) => {
    if (window.recaptchaVerifier) return window.recaptchaVerifier;

    const verifier = new RecaptchaVerifier(
      containerId,
      { size: 'invisible' },
      auth
    );
    window.recaptchaVerifier = verifier;
    return verifier;
  }, []);

  const sendOTP = useCallback(
    async (phone, containerId, role = 'patient') => {
      setLoading(true);
      setError(null);
      try {
        const digits = phone.replace(/\D/g, '');
        if (digits.length !== 10) {
          throw new Error('Invalid 10-digit mobile number');
        }

        console.log(`[AUTH CONTEXT] sendOTP initiated -> phone: "${digits}", role: "${role}"`);
        const isDevMode = import.meta.env.VITE_ENABLE_DEV_OTP === 'true' || import.meta.env.DEV;

        if (isDevMode) {
          console.log('[AUTH CONTEXT] Dev OTP mode active for phone:', digits);
          return { isDev: true, phone: digits, role };
        }

        const appVerifier = setupRecaptcha(containerId);
        const formatted = phone.startsWith('+')
          ? phone
          : `+91${digits}`;

        return await signInWithPhoneNumber(auth, formatted, appVerifier);
      } catch (err) {
        console.error('[AUTH CONTEXT ERROR sendOTP]:', err);
        setError(err.message || 'Failed to send OTP');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setupRecaptcha]
  );

  const verifyOTP = useCallback(
    async (confirmationResult, code, role = 'patient') => {
      setLoading(true);
      setError(null);
      try {
        const isDevMode = import.meta.env.VITE_ENABLE_DEV_OTP === 'true' || import.meta.env.DEV;

        if (confirmationResult?.isDev || isDevMode) {
          const targetRole = role || confirmationResult?.role || 'patient';
          const targetPhone = confirmationResult?.phone || '';
          console.log(`[AUTH CONTEXT] devLogin payload -> phone: "${targetPhone}", role: "${targetRole}", otp: "${code}"`);

          const res = await api.auth.devLogin({
            phone: targetPhone,
            role: targetRole,
            otp: code,
          });

          console.log('[AUTH CONTEXT] devLogin response:', res);

          if (res.role === 'patient') {
            persistAuth('patient', res.user, res.idToken);
            return { role: 'patient', user: res.user, isNew: false };
          }

          if (res.role === 'doctor') {
            persistAuth('doctor', res.user, res.idToken);
            return { role: 'doctor', user: res.user, isNew: false };
          }

          return res;
        }

        const cred = await confirmationResult.confirm(code);
        const idToken = await cred.user.getIdToken(true);
        const res = await api.auth.verify(idToken);

        if (res.role === 'patient') {
          persistAuth('patient', res.user, idToken);
          return { role: 'patient', isNew: false };
        }

        if (res.role === 'doctor') {
          persistAuth('doctor', res.user, idToken);
          return { role: 'doctor', isNew: false };
        }

        if (res.role === 'pharmacy') {
          persistAuth('pharmacy', res.user, idToken);
          return { role: 'pharmacy', isNew: false };
        }

        // 🆕 New doctor / patient / pharmacy
        return { role: null, isNew: true, idToken };
      } catch (err) {
        console.error('[AUTH CONTEXT ERROR verifyOTP]:', err);
        setError('Invalid OTP');
        throw new Error('Invalid OTP');
      } finally {
        setLoading(false);
      }
    },
    [persistAuth]
  );



  /* ======================
     🩺 REGISTER DOCTOR (FIXED)
     ====================== */
  const registerDoctor = useCallback(
    async ({ idToken, phone, name, clinicName, specialization }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.auth.registerDoctor({
          idToken,
          phone,
          name,
          clinicName,
          specialization,
        });

        persistAuth('doctor', res.user, idToken);
        return res;
      } catch (err) {
        setError(err.message || 'Doctor registration failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [persistAuth]
  );
  const registerPharmacy = useCallback(
    async ({ idToken, phone, name, pharmacyName, location }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.auth.registerPharmacy({
          idToken,
          phone,
          name,
          pharmacyName,
          location,
        });
        persistAuth('pharmacy', res.user, idToken);
        return res;
      } catch (err) {
        setError(err.message || 'Pharmacy registration failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [persistAuth]
  );
  const logout = useCallback(() => {
    auth.signOut().catch(() => {});
    clearStoredAuth();
    setUser(null);
    setFirebaseToken(null);
  }, [clearStoredAuth]);

  const getToken = useCallback(async () => {
    if (firebaseToken) return firebaseToken;
    const stored = readStoredAuth();
    if (stored?.idToken) {
      setFirebaseToken(stored.idToken);
      return stored.idToken;
    }
    const u = auth.currentUser;
    if (!u) return null;
    try {
      const t = await u.getIdToken(true);
      setFirebaseToken(t);
      return t;
    } catch {
      return null;
    }
  }, [firebaseToken, readStoredAuth]);


  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseToken,
        authReady,
        loading,
        error,
        setError,
        sendOTP,
        verifyOTP,
        registerDoctor,
        registerPharmacy,
        persistAuth,
        logout,
        getToken,
        isPatient: user?.role === 'patient',
        isDoctor: user?.role === 'doctor',
        isPharmacy: user?.role === 'pharmacy',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

