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
  const [user, setUser] = useState(null);
  const [firebaseToken, setFirebaseToken] = useState(null);
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
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setFirebaseToken(null);
        clearStoredAuth();
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
          const stored = readStoredAuth();
          if (stored) {
            persistAuth(stored.role, stored.user, idToken);
          }
        }
      } catch {
        clearStoredAuth();
        setUser(null);
        setFirebaseToken(null);
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
    async (phone, containerId) => {
      setLoading(true);
      setError(null);
      try {
        const appVerifier = setupRecaptcha(containerId);
        const formatted = phone.startsWith('+')
          ? phone
          : `+91${phone.replace(/\D/g, '')}`;

        return await signInWithPhoneNumber(auth, formatted, appVerifier);
      } catch (err) {
        setError(err.message || 'Failed to send OTP');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [setupRecaptcha]
  );

  const verifyOTP = useCallback(
    async (confirmationResult, code) => {
      setLoading(true);
      setError(null);
      try {
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
        setError(err.message || 'Invalid OTP');
        throw err;
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
    const u = auth.currentUser;
    if (!u) return null;
    const t = await u.getIdToken(true);
    setFirebaseToken(t);
    return t;
  }, []);

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

