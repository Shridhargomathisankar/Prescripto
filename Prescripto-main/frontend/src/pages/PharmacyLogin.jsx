import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';

export default function PharmacyLogin() {
  const navigate = useNavigate();
  const {
    user,
    authReady,
    sendOTP,
    verifyOTP,
    registerPharmacy,
    persistAuth,
    error,
    setError,
    loading,
  } = useAuth();

  if (authReady) {
    const stored = localStorage.getItem('prescripto_auth_v1');
    const parsed = stored ? JSON.parse(stored) : null;
    const effectiveRole = user?.role || parsed?.role;
    if (effectiveRole === 'pharmacy') {
      return <Navigate to="/pharmacy/dashboard" replace />;
    }
  }

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('phone');
  const [otp, setOtp] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [location, setLocation] = useState('');
  const [idToken, setIdToken] = useState(null);

  const confirmationResultRef = useRef(null);
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
      setError('Invalid phone number');
      return;
    }

    try {
      const result = await sendOTP(phone);
      confirmationResultRef.current = result;
      setStep('otp');
    } catch {}
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('Invalid OTP');
      return;
    }

    try {
      const res = await verifyOTP(confirmationResultRef.current, otp);

      if (res.role === 'pharmacy') {
        persistAuth('pharmacy', res.user, res.idToken);
        navigate('/pharmacy/dashboard', { replace: true });
        return;
      }

      if (res.role === 'doctor' || res.role === 'patient') {
        setError('This phone is already registered with another role.');
        return;
      }

      if (res.role === null && res.isNew) {
        setIdToken(res.idToken);
        setStep('register');
      }
    } catch {}
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (!ownerName.trim() || !pharmacyName.trim()) {
      setError('Owner name and pharmacy name are required');
      return;
    }

    try {
      const res = await registerPharmacy({
        idToken,
        phone,
        name: ownerName.trim(),
        pharmacyName: pharmacyName.trim(),
        location: location.trim(),
      });
      persistAuth('pharmacy', res.user, idToken);
      navigate('/pharmacy/dashboard', { replace: true });
    } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <Link to="/" className="text-teal-600 text-sm hover:underline mb-4 inline-block">
          ← Home
        </Link>

        <h1 className="text-2xl font-bold text-teal-800 mb-4">Pharmacy Login</h1>

        {error && <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}

        {step === 'phone' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <Input placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" loading={loading} className="w-full">Send OTP</Button>
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
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button type="submit" loading={loading} className="w-full">Verify OTP</Button>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Input label="Owner Name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            <Input label="Pharmacy Name" value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} />
            <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Button type="submit" loading={loading} className="w-full">Register Pharmacy</Button>
          </form>
        )}
      </div>
    </div>
  );
}
