import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import Button from '../components/Button';
import Input from '../components/Input';

export default function PatientRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { persistAuth } = useAuth();

  const { phone, idToken } = useMemo(() => {
    const state = location.state || {};
    return {
      phone: state.phone || '',
      idToken: state.idToken || '',
    };
  }, [location.state]);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [medicalInfo, setMedicalInfo] = useState('');

  // 🔒 Block direct access
  useEffect(() => {
    if (!phone || !idToken) {
      navigate('/patient/login', { replace: true });
    }
  }, [phone, idToken, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !age) {
      setError(t('fillRequired'));
      return;
    }

    try {
      setLoading(true);

      const res = await api.auth.registerPatient({
        idToken,
        phone,
        name: name.trim(),
        age: Number(age),
        bloodGroup: bloodGroup || undefined,
        medicalInfo: medicalInfo || undefined,
      });

      // ✅ NEW PATIENT
      persistAuth('patient', res.user, idToken);
      navigate('/patient/dashboard', { replace: true });

    } catch (err) {
      const msg =
        err?.message ||
        err?.error ||
        'Register failed';

      // 🔥 ALREADY REGISTERED → LOGIN FLOW
      if (msg === 'Phone already registered as patient') {
        try {
          const verifyRes = await api.auth.verify(idToken);
          if (verifyRes.role === 'patient') {
            persistAuth('patient', verifyRes.user, idToken);
            navigate('/patient/dashboard', { replace: true });
            return;
          }
        } catch {}
      }

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!phone || !idToken) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-teal-800 mb-2">
          {t('register')}
        </h1>

        <p className="text-slate-600 mb-6">
          {t('patient')} - {t('phoneNumber')}: {phone}
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t('name')} value={name} onChange={(e) => setName(e.target.value)} />
          <Input label={t('age')} type="number" value={age} onChange={(e) => setAge(e.target.value)} />
          <Input label={t('bloodGroup')} value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} />
          <Input label={t('medicalInfo')} value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} />

          <Button type="submit" loading={loading} className="w-full">
            {t('register')}
          </Button>
        </form>
      </div>
    </div>
  );
}
