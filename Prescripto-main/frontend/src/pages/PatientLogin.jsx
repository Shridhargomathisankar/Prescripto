import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Button from '../components/Button';
import Input from '../components/Input';

export default function PatientLogin() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user, authReady, sendOTP, verifyOTP, error, setError, loading } = useAuth();

  if (authReady) {
    const stored = localStorage.getItem('prescripto_auth_v1');
    const parsed = stored ? JSON.parse(stored) : null;
    const effectiveRole = user?.role || parsed?.role;
    if (effectiveRole === 'patient') {
      return <Navigate to="/patient/dashboard" replace />;
    }
  }

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('phone');
  const [otp, setOtp] = useState('');

  const confirmationResultRef = useRef(null);
  const enteredPhoneRef = useRef('');
  const otpInputRef = useRef(null);

  useEffect(() => {
    if (step === 'otp') {
      otpInputRef.current?.focus();
      const timer = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError(null);

    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError(t('invalidPhone'));
      return;
    }

    try {
      enteredPhoneRef.current = digits;
      const result = await sendOTP(phone);
      confirmationResultRef.current = result;
      setStep('otp');
    } catch {}
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError(t('invalidOTP'));
      return;
    }

    try {
      const result = await verifyOTP(
        confirmationResultRef.current,
        otp
      );

      // ✅ EXISTING PATIENT → DASHBOARD
      if (result.role === 'patient') {
        navigate('/patient/dashboard', { replace: true });
        return;
      }

      // ✅ ONLY NEW PATIENT → REGISTER
      if (result.role === null && result.isNew && result.idToken) {
        navigate('/patient/register', {
          state: {
            phone: enteredPhoneRef.current,
            idToken: result.idToken,
          },
          replace: true,
        });
      }
    } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <Link to="/" className="text-teal-600 text-sm mb-4 inline-block">
          ← {t('selectLanguage')}
        </Link>

        <h1 className="text-2xl font-bold text-teal-800 mb-2">
          {t('patient')} - {t('login')}
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {step === 'phone' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <Input
              placeholder="9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button type="submit" loading={loading} className="w-full">
              {t('sendOTP')}
            </Button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <Input
              ref={otpInputRef}
              autoFocus
              type="tel"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
              }
            />
            <Button type="submit" loading={loading} className="w-full">
              {t('verifyOTP')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
