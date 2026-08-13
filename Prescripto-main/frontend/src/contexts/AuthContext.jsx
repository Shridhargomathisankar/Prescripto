import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../config/api';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'prescripto_auth_v1';
const DEMO_OTP = '262626';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [firebaseToken, setFirebaseToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activePhoneRef = useRef('');

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
      const token = idToken || `demo-token-${userObj.phone || '9999999999'}`;
      setUser({ role, ...userObj });
      setFirebaseToken(token);
      writeStoredAuth(role, userObj, token);
    },
    [writeStoredAuth]
  );

  /* ======================
     Restore auth on refresh
     ====================== */
  useEffect(() => {
    const stored = readStoredAuth();
    if (stored && stored.role && stored.user) {
      setUser({ role: stored.role, ...stored.user });
      setFirebaseToken(stored.idToken || `demo-token-${stored.user.phone || ''}`);
    }
    setAuthReady(true);
  }, [readStoredAuth]);

  /* ======================
     UNIFIED DEVELOPMENT AUTH (DEMO CODE: 262626)
     ====================== */
  const sendOTP = useCallback(async (phone) => {
    setLoading(true);
    setError(null);
    try {
      const digits = String(phone || '').replace(/\D/g, '').slice(-10);
      if (digits.length !== 10) {
        throw new Error('Invalid phone number. Must be 10 digits.');
      }
      activePhoneRef.current = digits;
      return { phone: digits, demo: true };
    } catch (err) {
      setError(err.message || 'Failed to send verification code');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOTP = useCallback(
    async (confirmationResult, code) => {
      setLoading(true);
      setError(null);
      try {
        const cleanCode = String(code || '').trim();
        if (cleanCode !== DEMO_OTP) {
          throw new Error(`Invalid verification code. Please enter demo code ${DEMO_OTP}`);
        }

        const phone = confirmationResult?.phone || activePhoneRef.current || '9999999999';
        const idToken = `demo-token-${phone}`;

        // Verify role against backend Supabase records
        const res = await api.auth.verify(idToken);

        if (res.role === 'patient') {
          persistAuth('patient', res.user, idToken);
          return { role: 'patient', isNew: false, idToken, user: res.user };
        }

        if (res.role === 'doctor') {
          persistAuth('doctor', res.user, idToken);
          return { role: 'doctor', isNew: false, idToken, user: res.user };
        }

        if (res.role === 'pharmacy') {
          persistAuth('pharmacy', res.user, idToken);
          return { role: 'pharmacy', isNew: false, idToken, user: res.user };
        }

        // New user requiring profile registration
        return { role: null, isNew: true, idToken, phone };
      } catch (err) {
        setError(err.message || 'Verification failed');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [persistAuth]
  );

  /* ======================
     ROLE REGISTRATIONS
     ====================== */
  const registerDoctor = useCallback(
    async ({ idToken, phone, name, clinicName, specialization }) => {
      setLoading(true);
      setError(null);
      try {
        const token = idToken || `demo-token-${phone || activePhoneRef.current}`;
        const res = await api.auth.registerDoctor({
          idToken: token,
          phone: phone || activePhoneRef.current,
          name,
          clinicName,
          specialization,
        });

        persistAuth('doctor', res.user, token);
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
        const token = idToken || `demo-token-${phone || activePhoneRef.current}`;
        const res = await api.auth.registerPharmacy({
          idToken: token,
          phone: phone || activePhoneRef.current,
          name,
          pharmacyName,
          location,
        });
        persistAuth('pharmacy', res.user, token);
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
    clearStoredAuth();
    setUser(null);
    setFirebaseToken(null);
  }, [clearStoredAuth]);

  const getToken = useCallback(async () => {
    if (firebaseToken) return firebaseToken;
    const stored = readStoredAuth();
    return stored?.idToken || null;
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
