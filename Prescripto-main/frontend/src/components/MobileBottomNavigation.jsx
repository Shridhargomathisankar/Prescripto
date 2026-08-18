import { useLanguage } from '../contexts/LanguageContext';

export default function MobileBottomNavigation({
  role = 'patient',
  activeTab = 'home',
  onNavigate,
  onOpenProfile,
}) {
  const { t } = useLanguage();

  const isPatient = role === 'patient';
  const isDoctor = role === 'doctor';
  const isPharmacy = role === 'pharmacy';

  const rxTabName = isPatient ? 'prescriptions' : isDoctor ? 'patients' : 'stock';
  const rxTabLabel = isPatient
    ? t('prescriptions') || 'Prescriptions'
    : isDoctor
      ? t('patients') || 'Patients'
      : 'Stock';
  const rxTabIcon = isPatient ? '💊' : isDoctor ? '👥' : '📦';

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {/* Tab 1: Home / Dashboard */}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate(isDoctor ? 'dashboard' : 'home')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] min-w-[48px] transition ${activeTab === 'home' || activeTab === 'dashboard'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <span className="text-xl leading-none">🏠</span>
          <span className="text-[10px] mt-1 font-medium">{t('home') || 'Home'}</span>
          {(activeTab === 'home' || activeTab === 'dashboard') && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5" />
          )}
        </button>

        {/* Tab 2: Prescriptions / Patients / Stock */}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate(rxTabName)}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] min-w-[48px] transition ${activeTab === rxTabName || (isDoctor && activeTab === 'search')
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <span className="text-xl leading-none">{rxTabIcon}</span>
          <span className="text-[10px] mt-1 font-medium">{rxTabLabel}</span>
          {(activeTab === rxTabName || (isDoctor && activeTab === 'search')) && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5" />
          )}
        </button>

        {/* Tab 3: Requests */}
        <button
          type="button"
          onClick={() => onNavigate && onNavigate('requests')}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] min-w-[48px] transition ${activeTab === 'requests'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <span className="text-xl leading-none">📥</span>
          <span className="text-[10px] mt-1 font-medium">{t('requests') || 'Requests'}</span>
          {activeTab === 'requests' && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5" />
          )}
        </button>

        {/* Tab 4: Profile */}


        <button
          type="button"
          onClick={() => {
            if (onOpenProfile) onOpenProfile();
            else if (onNavigate) onNavigate('profile');
          }}
          className={`flex flex-col items-center justify-center flex-1 h-full min-h-[48px] min-w-[48px] transition ${activeTab === 'profile'
              ? 'text-blue-600 font-bold'
              : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          <span className="text-xl leading-none">👤</span>
          <span className="text-[10px] mt-1 font-medium">{t('profile') || 'Profile'}</span>
          {activeTab === 'profile' && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-0.5" />
          )}
        </button>
      </div>
    </nav>
  );
}
