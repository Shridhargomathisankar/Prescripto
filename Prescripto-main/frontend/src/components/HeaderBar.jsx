import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export default function HeaderBar({
  title = 'PATIENT DASHBOARD',
  user,
  role = 'patient',
  unreadCount = 0,
  onOpenProfile,
  onOpenNotifications,
  onNavigate,
  onLogout,
}) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeRole = (user?.role || role || 'patient').toLowerCase();

  const getRoleMenuItems = () => {
    if (activeRole === 'doctor') {
      return [
        { id: 'dashboard', label: t('dashboard') || 'Dashboard', icon: '📊' },
        { id: 'search', label: t('searchPatient') || 'Patient Search', icon: '🔍' },
        { id: 'active-consultations', label: 'Active Consultations', icon: '🩺' },
        { id: 'create-prescription', label: t('addPrescription') || 'Create Prescription', icon: '✏️' },
        { id: 'patient-reports', label: 'Patient Reports', icon: '📄' },
        { id: 'notifications', label: t('consultRequests') || 'Consult Requests', icon: '🔔' },
        { id: 'notifications', label: t('notifications') || 'Notifications', icon: '🔔' },
        { id: 'profile', label: t('profile') || 'Profile', icon: '👤', isAction: 'profile' },
        { id: 'settings', label: t('settings') || 'Settings', icon: '⚙️' },
      ];
    }

    if (activeRole === 'pharmacy') {
      return [
        { id: 'home', label: t('dashboard') || 'Dashboard', icon: '📊' },
        { id: 'requests', label: 'Medicine Requests', icon: '📦' },
        { id: 'pending-orders', label: 'Pending Orders', icon: '⏳' },
        { id: 'ready-orders', label: 'Ready Orders', icon: '✅' },
        { id: 'completed-orders', label: 'Completed Orders', icon: '🎉' },
        { id: 'stock', label: 'Medicine Stock', icon: '💊' },
        { id: 'notifications', label: t('notifications') || 'Notifications', icon: '🔔', isAction: 'notifications' },
        { id: 'profile', label: t('profile') || 'Profile', icon: '👤', isAction: 'profile' },
        { id: 'settings', label: t('settings') || 'Settings', icon: '⚙️' },
      ];
    }

    // Default: Patient Menu
    return [
      { id: 'home', label: t('home') || 'Home', icon: '🏠' },
      { id: 'prescriptions', label: t('prescriptions') || 'Prescriptions', icon: '📋' },
      { id: 'reports', label: t('scanReports') || 'Lab Reports', icon: '📄' },
      { id: 'reminders', label: t('medicineReminders') || 'Medicine Reminders', icon: '⏰' },
      { id: 'consult-again', label: t('consultAgain') || 'Consult Again', icon: '🩺' },
      { id: 'medicine-status', label: 'Medicine Requests', icon: '📦' },
      { id: 'maps', label: t('findNearbyClinics') || 'Nearby Clinics', icon: '🏥' },
      { id: 'requests', label: t('requests') || 'Requests', icon: '📑' },
      { id: 'profile', label: t('profile') || 'Profile', icon: '👤', isAction: 'profile' },
      { id: 'settings', label: t('settings') || 'Settings', icon: '⚙️' },
    ];
  };

  const menuItems = getRoleMenuItems();

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4 transition-all">
      {/* Left: Brand Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-sky-500 to-teal-400 text-white flex items-center justify-center font-bold text-xl shadow-md">
          ✚
        </div>
        <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-teal-600 text-xl tracking-tight hidden sm:inline-block">
          Prescripto
        </span>
      </div>

      {/* Center: Dashboard Title */}
      <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <h1 className="text-xs sm:text-sm font-extrabold text-slate-800 tracking-wider uppercase bg-slate-100/80 px-3 sm:px-4 py-1 rounded-full border border-slate-200/60 shadow-2xs">
          {title}
        </h1>
      </div>

      {/* Right Controls: Profile -> Notifications -> Menu */}
      <div className="flex items-center gap-2 sm:gap-3" ref={menuRef}>
        {/* 1. Profile Icon */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-teal-500 text-white font-bold text-sm flex items-center justify-center shadow-sm hover:shadow-md hover:scale-105 transition-all"
          title="Open Profile"
        >
          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
        </button>

        {/* 2. Notifications Icon */}
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-600 flex items-center justify-center transition-all"
          title="Notifications"
        >
          <span className="text-base">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-blue-600 rounded-full shadow-xs border-2 border-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* 3. Menu Icon & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 flex items-center justify-center transition-all font-bold text-lg"
            title="Menu"
          >
            ☰
          </button>

          {/* Menu Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-12 w-60 bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {activeRole.toUpperCase()} MENU
                </p>
                <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {activeRole}
                </span>
              </div>

              {menuItems.map((item, idx) => (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (item.isAction === 'profile' && onOpenProfile) {
                      onOpenProfile();
                    } else if (item.isAction === 'notifications' && onOpenNotifications) {
                      onOpenNotifications();
                    } else if (onNavigate) {
                      onNavigate(item.id);
                    }
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition"
                >
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}

              <div className="border-t border-slate-100 my-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (onLogout) onLogout();
                  }}
                  className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-3 transition"
                >
                  <span className="text-base">🚪</span>
                  <span>{t('logout') || 'Logout'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
