import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import Input from '../components/Input';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const {
    user,
    authReady,
    sendOTP,
    verifyOTP,
    registerDoctor,
    persistAuth,
    error,
    setError,
    loading,
  } = useAuth();

  if (authReady) {
    const stored = localStorage.getItem('prescripto_auth_v1');
    const parsed = stored ? JSON.parse(stored) : null;
    const effectiveRole = user?.role || parsed?.role;
    if (effectiveRole === 'doctor') {
      return <Navigate to="/doctor/dashboard" replace />;
    }
  }

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('phone');
  const [otp, setOtp] = useState('');

  // Register fields for new doctor
  const [doctorName, setDoctorName] = useState('');
  const [clinicName, setClinicName] = useState('');

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

  // ======================
  // SEND OTP
  // ======================
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

  // ======================
  // VERIFY OTP
  // ======================
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('Invalid OTP');
      return;
    }

    try {
      const res = await verifyOTP(
        confirmationResultRef.current,
        otp
      );

      // ✅ EXISTING DOCTOR
      if (res.role === 'doctor') {
        persistAuth('doctor', res.user, res.idToken);
        navigate('/doctor/dashboard', { replace: true });
        return;
      }

      // 🆕 NEW DOCTOR
      if (res.role === null && res.isNew) {
        setIdToken(res.idToken);
        setStep('register');
      }
    } catch {}
  };

  // ======================
  // REGISTER DOCTOR
  // ======================
  const handleRegisterDoctor = async (e) => {
    e.preventDefault();
    setError(null);

    if (!doctorName.trim() || !clinicName.trim()) {
      setError('Doctor name & clinic name required');
      return;
    }

    try {
      const res = await registerDoctor({
        idToken,
        phone,
        name: doctorName.trim(),
        clinicName: clinicName.trim(),
      });

      persistAuth('doctor', res.user, idToken);
      navigate('/doctor/dashboard', { replace: true });
    } catch {}
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <Link to="/" className="text-teal-600 text-sm hover:underline mb-4 inline-block">
          ← Home
        </Link>

        <h1 className="text-2xl font-bold text-teal-800 mb-4">
          Doctor Login
        </h1>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">
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
              Send OTP
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
              Verify OTP
            </Button>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={handleRegisterDoctor} className="space-y-4">
            <Input
              label="Doctor Name"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
            />
            <Input
              label="Clinic / Hospital Name"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
            />
            <Button type="submit" loading={loading} className="w-full">
              Register & Continue
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
