import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth as firebaseAuth } from '../config/firebase';
import Input from '../components/Input';
import Button from '../components/Button';

export default function PharmacyLogin() {
  const navigate = useNavigate();
  const {
    sendOTP,
    verifyOTP,
    registerPharmacy,
    persistAuth,
    error,
    setError,
    loading,
  } = useAuth();

  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('phone');
  const [otp, setOtp] = useState('');
  const [method, setMethod] = useState('phone'); // 'phone' or 'email'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [location, setLocation] = useState('');
  const [idToken, setIdToken] = useState(null);

  const confirmationResultRef = useRef(null);

  useEffect(() => {
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete window.recaptchaVerifier;
      }
    };
  }, []);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError(null);

    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Invalid phone number');
      return;
    }

    try {
      const result = await sendOTP(phone, 'recaptcha-pharmacy');
      confirmationResultRef.current = result;
      setStep('otp');
    } catch {
      // handled by context
    }
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
        navigate('/pharmacy/dashboard', { replace: true });
        return;
      }

      if (res.role === 'doctor' || res.role === 'patient') {
        setError('This phone is already registered with another role.');
        return;
      }

      if (res.role === null && res.idToken) {
        setIdToken(res.idToken);
        setStep('register');
      }
    } catch {
      // handled by context
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);

    if (!ownerName.trim() || !pharmacyName.trim()) {
      setError('Owner name and pharmacy name are required');
      return;
    }

    try {
      await registerPharmacy({
        idToken,
        phone,
        name: ownerName.trim(),
        pharmacyName: pharmacyName.trim(),
        location: location.trim(),
      });
      navigate('/pharmacy/dashboard', { replace: true });
    } catch {
      // handled by context
    }
  };

  /* ========================
     Email / Password flow
  ======================== */
  const handleEmailSignIn = async (e) => {
    e && e.preventDefault();
    setError(null);
    try {
      const auth = getAuth(firebaseAuth);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await cred.user.getIdToken();
      // verify role
      const res = await (await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) })).json();
      if (res.role === 'pharmacy') {
        persistAuth('pharmacy', res.user, token);
        navigate('/pharmacy/dashboard', { replace: true });
        return;
      }
      if (res.role === 'doctor' || res.role === 'patient') {
        setError('This account is registered with another role.');
        return;
      }
      // new account → prompt register
      setIdToken(token);
      setStep('register');
    } catch (err) {
      setError(err.message || 'Email sign-in failed');
    }
  };

  const handleEmailRegister = async (e) => {
    e && e.preventDefault();
    setError(null);
    try {
      // create firebase user first
      const auth = getAuth(firebaseAuth);
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const token = await userCred.user.getIdToken();
      // create pharmacy record on backend
      const resp = await fetch('/api/auth/register-pharmacy-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, email: email.trim(), name: ownerName.trim(), pharmacyName: pharmacyName.trim(), location: location.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Registration failed');
      persistAuth('pharmacy', data.user, token);
      navigate('/pharmacy/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Email registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
      <div id="recaptcha-pharmacy" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <Link to="/" className="text-teal-600 text-sm hover:underline mb-4 inline-block">
          ← Home
        </Link>

        <h1 className="text-2xl font-bold text-teal-800 mb-4">Pharmacy Login</h1>

        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setMethod('phone')} className={`px-3 py-1 rounded ${method === 'phone' ? 'bg-teal-600 text-white' : 'bg-white text-teal-700 border'}`}>Phone</button>
          <button type="button" onClick={() => setMethod('email')} className={`px-3 py-1 rounded ${method === 'email' ? 'bg-teal-600 text-white' : 'bg-white text-teal-700 border'}`}>Email</button>
        </div>

        {error && <div className="mb-4 p-3 rounded bg-red-50 text-red-700 text-sm">{error}</div>}

        {method === 'phone' && step === 'phone' && (
          <form onSubmit={handleSendOTP} className="space-y-4">
            <Input placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button type="submit" loading={loading} className="w-full">Send OTP</Button>
          </form>
        )}

        {method === 'email' && (
          <div>
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <Input placeholder="email@pharmacy.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div className="flex gap-2">
                <Button type="submit" loading={loading} className="w-full">Sign in</Button>
                <Button type="button" onClick={handleEmailRegister} className="w-full">Register</Button>
              </div>
            </form>
          </div>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOTP} className="space-y-4">
            <Input
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <Button type="submit" loading={loading} className="w-full">Verify OTP</Button>
          </form>
        )}

        {step === 'register' && (
          <form onSubmit={method === 'email' ? handleEmailRegister : handleRegister} className="space-y-4">
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
