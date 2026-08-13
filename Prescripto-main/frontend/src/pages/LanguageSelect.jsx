import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

export default function LanguageSelect() {
  const navigate = useNavigate();
  const { t, setLanguage, lang } = useLanguage();

  const handleSelect = (l) => {
    setLanguage(l);
    navigate('/patient/login');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50 p-4">
      <div className="w-full max-w-md flex justify-end px-4">
        <button onClick={() => navigate('/pharmacy/login')} className="text-xs px-2 py-1 rounded bg-white/80 border border-teal-100 text-teal-700">Pharmacy Login</button>
      </div>
      <div className="w-full max-w-md animate-fade-in">
        <h1 className="text-3xl font-bold text-teal-800 text-center mb-2">{t('appName')}</h1>
        <p className="text-slate-600 text-center mb-8">{t('selectLanguage')}</p>
        <div className="space-y-3">
          <button
            onClick={() => handleSelect('en')}
            className="w-full py-4 px-6 rounded-xl bg-white border-2 border-teal-200 text-teal-800 font-medium shadow-sm hover:border-teal-400 hover:shadow-md transition-all duration-200"
          >
            {t('english')}
          </button>
          <button
            onClick={() => handleSelect('ta')}
            className="w-full py-4 px-6 rounded-xl bg-white border-2 border-teal-200 text-teal-800 font-medium shadow-sm hover:border-teal-400 hover:shadow-md transition-all duration-200"
          >
            {t('tamil')}
          </button>
        </div>
        <p className="text-sm text-slate-500 text-center mt-6">
          {lang === 'en' ? 'Patient flow starts with language selection.' : 'நோயாளி பயணம் மொழி தேர்வுடன் தொடங்கும்.'}
        </p>
        <p className="text-sm text-slate-500 text-center mt-2">
          <Link to="/doctor/login" className="text-teal-600 hover:underline">Doctor? Login here</Link>
        </p>
      </div>
    </div>
  );
}
