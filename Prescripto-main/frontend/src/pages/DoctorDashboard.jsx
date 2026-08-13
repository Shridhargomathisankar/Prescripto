import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../config/api';
import { useRealtimeSubscription } from '../hooks/useRealtime';
import PrescriptionCard from '../components/PrescriptionCard';
import Button from '../components/Button';
import Input from '../components/Input';
import MedicineInput from '../components/MedicineInput';
import HeaderBar from '../components/HeaderBar';
import ProfileDrawer from '../components/ProfileDrawer';
import NotificationsPanel from '../components/NotificationsPanel';
import RequestsScreen from '../components/RequestsScreen';
import MobileBottomNavigation from '../components/MobileBottomNavigation';

/* =========================
   UI: Logo icon (medical cross)
========================= */
function LogoIcon({ className = 'w-8 h-8' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2v20M2 12h20M12 6l-4 4 4 4 4-4-4-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* =========================
   TOP HEADER
========================= */
function TopHeader({ doctor, sidebarOpen, onToggleSidebar, notificationCount, onOpenNotifications }) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 md:hidden"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <LogoIcon className="w-8 h-8 text-blue-600" />
          <span className="font-semibold text-blue-700 text-lg">Prescripto</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          aria-label="Notifications"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 6h.01M9 17h.01" />
          </svg>
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-xs font-medium text-white bg-blue-600 rounded-full">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </button>
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm">
            {doctor?.name ? doctor.name.charAt(0).toUpperCase() : 'D'}
          </div>
          <span className="text-sm font-medium text-slate-700">Dr. {doctor?.name}</span>
        </div>
      </div>
    </header>
  );
}

/* =========================
   LEFT SIDEBAR (Desktop: always visible | Mobile: drawer)
========================= */
function Sidebar({ doctor, currentView, onNavigate, onLogout, open, onClose, t }) {
  const items = [
    { id: 'dashboard', label: t('dashboard') || 'Dashboard', icon: 'dashboard' },
    { id: 'patients', label: t('patients') || 'Patients', icon: 'people' },
    { id: 'prescriptions', label: t('prescriptions') || 'Prescriptions', icon: 'document' },
    { id: 'notifications', label: t('notifications') || 'Notifications', icon: 'bell' },
    { id: 'profile', label: t('profile') || 'Profile', icon: 'user' },
    { id: 'settings', label: t('settings') || 'Settings', icon: 'cog' },
  ];

  const handleClick = (id) => {
    onNavigate(id);
    onClose();
  };

  const content = (
    <>
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold">
            {doctor?.name ? doctor.name.charAt(0).toUpperCase() : 'D'}
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">Dr. {doctor?.name}</h2>
            <p className="text-xs text-slate-500 truncate max-w-[180px]">{doctor?.clinicName}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 text-sm overflow-y-auto">
        {items.map(({ id, label, icon }) => {
          const active = currentView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleClick(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {icon === 'dashboard' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
              )}
              {icon === 'people' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              )}
              {icon === 'document' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              )}
              {icon === 'bell' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 6h.01M9 17h.01" /></svg>
              )}
              {icon === 'user' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              )}
              {icon === 'cog' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              )}
              {label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => { onLogout(); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-red-600 hover:bg-red-50 text-sm font-medium"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          {t('logout')}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: always visible */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-slate-200 flex-col flex-shrink-0">
        {content}
      </aside>

      {/* Mobile: overlay + drawer */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 max-w-[85vw] bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        {content}
      </aside>
    </>
  );
}

/* =========================
   PROFILE SCREEN – read-only by default, Edit + Save to DB
========================= */
function ProfileScreen({ doctor, onSave, getToken, t }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(doctor?.name || '');
  const [clinicName, setClinicName] = useState(doctor?.clinicName || '');
  const [specialization, setSpecialization] = useState(doctor?.specialization || '');
  const [experience, setExperience] = useState(doctor?.experience != null ? String(doctor.experience) : '');
  const [location, setLocation] = useState(doctor?.location || '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    setName(doctor?.name || '');
    setClinicName(doctor?.clinicName || '');
    setSpecialization(doctor?.specialization || '');
    setExperience(doctor?.experience != null ? String(doctor.experience) : '');
    setLocation(doctor?.location || '');
  }, [doctor?.name, doctor?.clinicName, doctor?.specialization, doctor?.experience, doctor?.location]);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await onSave(token, {
        name: name.trim(),
        clinicName: clinicName.trim(),
        specialization: specialization.trim(),
        experience: experience === '' ? null : Number(experience),
        location: location.trim(),
      });
      setEditing(false);
    } catch (err) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const readOnlyClass = 'w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700';
  const editClass = 'w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{t('doctorProfile')}</h1>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-blue-600 hover:bg-blue-50 font-medium text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            {t('edit')}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditing(false)} className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-medium">{t('cancel') || 'Cancel'}</button>
            <Button type="button" onClick={handleSave} loading={saving} className="rounded-xl bg-blue-600 hover:bg-blue-700">{t('saveChanges') || 'Save Changes'}</Button>
          </div>
        )}
      </div>
      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Doctor Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Doctor Name" readOnly={!editing} className={editing ? editClass : readOnlyClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Clinic / Hospital Name</label>
          <input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Clinic / Hospital Name" readOnly={!editing} className={editing ? editClass : readOnlyClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Specialization</label>
          <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Specialization" readOnly={!editing} className={editing ? editClass : readOnlyClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Experience (years)</label>
          <input type="number" min="0" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 10" readOnly={!editing} className={editing ? editClass : readOnlyClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Location</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or address" readOnly={!editing} className={editing ? editClass : readOnlyClass} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-1">Phone Number</label>
          <p className="text-slate-800">{doctor?.phone || '—'}</p>
          <p className="text-xs text-slate-400">{t('changePhoneInSettings')}</p>
        </div>
      </div>
    </div>
  );
}

/* =========================
   SETTINGS SCREEN – change phone, persist in DB
========================= */
function SettingsScreen({ doctor, getToken, onUpdate, t }) {
  const [phone, setPhone] = useState(doctor?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleSavePhone = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length !== 10) {
      setError('Phone must be 10 digits');
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await api.doctors.updateMe(token, { phone: normalized });
      setSuccess(true);
      onUpdate();
    } catch (err) {
      setError(err.message || 'Failed to update phone');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">{t('settings')}</h1>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <form onSubmit={handleSavePhone} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit phone"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              maxLength={15}
            />
            <p className="text-xs text-slate-400 mt-1">Changing phone will update your login number. Use 10 digits.</p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Phone updated successfully.</p>}
          <Button type="submit" loading={saving} className="rounded-xl bg-blue-600 hover:bg-blue-700">{t('savePhone') || 'Save Phone'}</Button>
        </form>
      </div>
    </div>
  );
}

/* =========================
   STATS CARDS (placeholders when data not available)
========================= */
function StatsCards({ totalPatients, prescriptionsGiven, notifications, t }) {
  const cards = [
    { label: t('totalPatients'), value: totalPatients, icon: 'document' },
    { label: t('prescriptionsGiven'), value: prescriptionsGiven, icon: 'prescription' },
    { label: t('notifications'), value: notifications, icon: 'bell' },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map(({ label, value, icon }) => (
        <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <p className="text-2xl font-semibold text-slate-800 mt-1">{value != null ? value : '—'}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              {icon === 'document' && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              )}
              {icon === 'prescription' && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              )}
              {icon === 'bell' && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 6h.01M9 17h.01" /></svg>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { getToken, logout } = useAuth();

  const [doctor, setDoctor] = useState(null);
  const [doctorLoading, setDoctorLoading] = useState(true);

  const [patientId, setPatientId] = useState('');
  const [patient, setPatient] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [disease, setDisease] = useState('');
  const [medicines, setMedicines] = useState([
    { name: '', dosage: '', morning: false, afternoon: false, evening: false, night: false, durationInDays: '' },
  ]);

  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [accessActionLoading, setAccessActionLoading] = useState(false);
  const [accessActionMessage, setAccessActionMessage] = useState('');
  const [accessActionError, setAccessActionError] = useState('');

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('tab') || 'dashboard';

  const setView = useCallback(
    (newTab) => {
      if (!newTab || newTab === 'dashboard') {
        setSearchParams({});
      } else {
        setSearchParams({ tab: newTab });
      }
    },
    [setSearchParams]
  );
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [counts, setCounts] = useState({ totalPatients: null, prescriptionsGiven: null, unreadNotifications: null });
  const [patientsList, setPatientsList] = useState([]);
  const [prescriptionsList, setPrescriptionsList] = useState([]);
  const [notificationsList, setNotificationsList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [notifActionLoading, setNotifActionLoading] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleId, setRescheduleId] = useState(null);
  const notificationCount = counts.unreadNotifications ?? 0;

  /* =========================
     LOAD DOCTOR
  ========================= */
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error();
        const data = await api.doctors.me(token);
        setDoctor(data);
      } catch {
        logout();
        navigate('/doctor/login', { replace: true });
      } finally {
        setDoctorLoading(false);
      }
    })();
  }, [getToken, logout, navigate]);

  const refreshDoctorCounts = useCallback(async () => {
    if (!doctor) return;
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.doctors.dashboardCounts(token);
      setCounts((prev) => {
        if (
          prev.totalPatients === data.totalPatients &&
          prev.prescriptionsGiven === data.prescriptionsGiven &&
          prev.unreadNotifications === data.unreadNotifications
        ) {
          return prev;
        }
        return {
          totalPatients: data.totalPatients,
          prescriptionsGiven: data.prescriptionsGiven,
          unreadNotifications: data.unreadNotifications,
        };
      });
    } catch {
      setCounts({ totalPatients: 0, prescriptionsGiven: 0, unreadNotifications: 0 });
    }
  }, [doctor, getToken]);

  const refreshDoctorData = useCallback(async () => {
    refreshDoctorCounts();
    if (patient?.patientId) {
      try {
        const token = await getToken();
        if (token) {
          const data = await api.doctors.getPatient(token, patient.patientId);
          setPatient(data);
        }
      } catch (_) {}
    }
  }, [doctor, patient?.patientId, refreshDoctorCounts, getToken]);

  /* Load dashboard counts when doctor is ready */
  useEffect(() => {
    refreshDoctorData();
  }, [refreshDoctorData]);

  // Realtime Supabase Subscription for Doctor Dashboard
  useRealtimeSubscription(
    ['access_requests', 'consult_requests', 'doctor_notifications', 'prescriptions'],
    refreshDoctorData,
    Boolean(doctor)
  );

  /* Load lists when switching view */
  useEffect(() => {
    if (!doctor || view === 'dashboard') return;
    (async () => {
      setListLoading(true);
      try {
        const token = await getToken();
        if (!token) return;
        if (view === 'patients') {
          const data = await api.doctors.patientsList(token);
          setPatientsList(Array.isArray(data) ? data : []);
        } else if (view === 'prescriptions') {
          const data = await api.doctors.prescriptionsList(token);
          setPrescriptionsList(Array.isArray(data) ? data : []);
        } else if (view === 'notifications') {
          const data = await api.doctors.notifications(token);
          setNotificationsList(Array.isArray(data) ? data : []);
        }
      } catch {
        if (view === 'patients') setPatientsList([]);
        if (view === 'prescriptions') setPrescriptionsList([]);
        if (view === 'notifications') setNotificationsList([]);
      } finally {
        setListLoading(false);
      }
    })();
  }, [doctor, view, getToken]);

  /* =========================
     SEARCH PATIENT
  ========================= */
  const handleSearch = async (e) => {
    e.preventDefault();
    setSearchError(null);

    const id = patientId.trim().toUpperCase();
    if (!id) return;

    setSearchLoading(true);
    try {
      const token = await getToken();
      const data = await api.doctors.getPatient(token, id);
      setPatient(data);
      setShowAddForm(false);
    } catch (err) {
      setSearchError(err.message || t('patientNotFound'));
      setPatient(null);
    } finally {
      setSearchLoading(false);
    }
  };

  /* =========================
     REQUEST PATIENT ACCESS (UI wiring)
  ========================= */
  const handleRequestAccess = async () => {
    if (!patient?.patientId) return;
    setAccessActionLoading(true);
    setAccessActionMessage('');
    setAccessActionError('');
    try {
      const token = await getToken();
      await api.doctors.requestAccess(token, patient.patientId);
      const data = await api.doctors.getPatient(token, patient.patientId);
      setPatient(data);
      setAccessActionMessage('Access request sent successfully.');
    } catch (err) {
      setAccessActionError(err.message || 'Failed to send access request');
    } finally {
      setAccessActionLoading(false);
    }
  };

  /* =========================
     PRESCRIPTION HELPERS
  ========================= */
  const addMedicineRow = () => {
    setMedicines((p) => [
      ...p,
      { name: '', dosage: '', morning: false, afternoon: false, evening: false, night: false, durationInDays: '' },
    ]);
  };

  const updateMedicine = (i, field, value) => {
    setMedicines((p) =>
      p.map((m, idx) => (idx === i ? { ...m, [field]: value } : m))
    );
  };

  const removeMedicine = (i) => {
    if (medicines.length <= 1) return;
    setMedicines((p) => p.filter((_, idx) => idx !== i));
  };

  const handleSavePrescription = async (e) => {
    e.preventDefault();
    setSaveError(null);

    if (!patient || !disease.trim()) {
      setSaveError(t('fillRequired'));
      return;
    }

    const list = medicines
      .map((m) => ({ ...m, name: m.name.trim() }))
      .filter((m) => m.name && m.durationInDays && m.durationInDays > 0);

    if (!list.length) {
      setSaveError(t('fillRequired'));
      return;
    }

    setSaveLoading(true);
    try {
      const token = await getToken();
      await api.doctors.addPrescription(token, patient.patientId, {
        disease: disease.trim(),
        medicines: list,
      });

      const data = await api.doctors.getPatient(token, patient.patientId);
      setPatient(data);

      setShowAddForm(false);
      setDisease('');
      setMedicines([{ name: '', dosage: '', morning: false, afternoon: false, evening: false, night: false, durationInDays: '' }]);
    } catch (err) {
      setSaveError(err.message || t('error'));
    } finally {
      setSaveLoading(false);
    }
  };

  if (doctorLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased">
      <HeaderBar
        title="DOCTOR DASHBOARD"
        user={doctor ? { ...doctor, role: 'doctor' } : null}
        unreadCount={notificationCount}
        onOpenProfile={() => setProfileDrawerOpen(true)}
        onOpenNotifications={() => setNotifPanelOpen((o) => !o)}
        onNavigate={setView}
        onLogout={logout}
      />

      <NotificationsPanel
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        notifications={notificationsList}
        onMarkRead={async (id) => {
          try {
            const token = await getToken();
            if (token) await api.doctors.acceptNotification(token, id);
            const data = await api.doctors.notifications(token);
            setNotificationsList(Array.isArray(data) ? data : []);
          } catch (_) {}
        }}
      />

      <ProfileDrawer
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        user={doctor ? { ...doctor, role: 'doctor' } : null}
        onEditProfile={() => setView('profile')}
        onOpenSettings={() => setView('settings')}
        onLogout={logout}
      />

      <div className="flex-1 flex">
        <Sidebar
          doctor={doctor}
          currentView={view}
          onNavigate={setView}
          onLogout={logout}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          t={t}
        />

        <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 space-y-6">
          {view === 'requests' ? (
            <RequestsScreen
              accessRequests={patient?.accessRequests}
              consultRequests={notificationsList}
              onNavigateHome={() => setView('dashboard')}
            />
          ) : view === 'profile' ? (
            <ProfileScreen
              doctor={doctor}
              onSave={async (token, body) => {
                await api.doctors.updateMe(token, body);
                const data = await api.doctors.me(token);
                setDoctor(data);
              }}
              getToken={getToken}
              t={t}
            />
          ) : view === 'settings' ? (
            <SettingsScreen doctor={doctor} getToken={getToken} t={t} onUpdate={() => {
              getToken().then(async (token) => {
                if (token) {
                  const data = await api.doctors.me(token);
                  setDoctor(data);
                }
              });
            }} />
          ) : (
            <>
              {/* Welcome + Patient Search */}
              <section className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-lg">
                    {doctor?.name ? doctor.name.charAt(0).toUpperCase() : 'D'}
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-slate-800">{t('welcomeDr')} {doctor?.name}</h1>
                    <p className="text-sm text-slate-500">{doctor?.clinicName}</p>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      </span>
                      <input
                        type="text"
                        placeholder={t('searchByPatientId')}
                        value={patientId}
                        onChange={(e) => setPatientId(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                      />
                    </div>
                    <Button type="submit" loading={searchLoading} className="rounded-xl px-5 bg-blue-600 hover:bg-blue-700 focus:ring-blue-500">
                      <span className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        {t('search')}
                      </span>
                    </Button>
                  </form>
                  {searchError && (
                    <p className="mt-2 text-sm text-red-600">{searchError}</p>
                  )}
                </div>
              </section>

              {/* Stats cards – real counts from API */}
              <StatsCards
                totalPatients={counts.totalPatients}
                prescriptionsGiven={counts.prescriptionsGiven}
                notifications={notificationCount}
                t={t}
              />

              {/* Patients list screen */}
              {view === 'patients' && (
                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('patientsConsulted')}</h2>
                  {listLoading ? (
                    <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                  ) : patientsList.length === 0 ? (
                    <p className="text-slate-500">{t('noPatientsYet')}</p>
                  ) : (
                    <ul className="space-y-3">
                      {patientsList.map((p) => (
                        <li key={p.patientId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div>
                            <span className="font-medium text-slate-800">{p.name}</span>
                            <span className="text-slate-500 text-sm ml-2">ID: {p.patientId}</span>
                            {p.activeSession?.status === 'active' && (
                              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Session active</span>
                            )}
                          </div>
                          <button type="button" onClick={() => { setPatientId(p.patientId); setView('dashboard'); }} className="text-blue-600 text-sm font-medium hover:underline">{t('view')}</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* Prescriptions list screen */}
              {view === 'prescriptions' && (
                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('prescriptionsCreated')}</h2>
                  {listLoading ? (
                    <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                  ) : prescriptionsList.length === 0 ? (
                    <p className="text-slate-500">{t('noPrescriptionsYet')}</p>
                  ) : (
                    <div className="space-y-4">
                      {prescriptionsList.map((pr, i) => (
                        <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-slate-800">{pr.disease}</p>
                              <p className="text-sm text-slate-500">Patient: {pr.patientName} ({pr.patientId})</p>
                              <p className="text-xs text-slate-400">{pr.createdAt ? new Date(pr.createdAt).toLocaleDateString() : ''}</p>
                            </div>
                          </div>
                          {Array.isArray(pr.medicines) && pr.medicines.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {pr.medicines.map((m, idx) => (
                                <p key={`${pr._id || i}-${m.name}-${idx}`} className="text-sm text-slate-600">
                                  {m.name}: {Number(m.durationInDays) || Number(pr.duration) || 7} day(s)
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Notifications screen – consult requests with Accept / Reschedule */}
              {view === 'notifications' && (
                <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">{t('consultationRequests')}</h2>
                  {listLoading ? (
                    <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
                  ) : notificationsList.length === 0 ? (
                    <p className="text-slate-500">{t('noNotifications')}</p>
                  ) : (
                    <ul className="space-y-4">
                      {notificationsList.map((n) => (
                        <li key={n._id} className={`p-4 rounded-xl border ${!n.read ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-slate-50/50'}`}>
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <p className="font-medium text-slate-800">{n.patientName}</p>
                              <p className="text-sm text-slate-600">Requested: {n.requestedDate ? new Date(n.requestedDate).toLocaleDateString() : '—'}</p>
                              {n.status === 'rescheduled' && n.rescheduledDate && (
                                <p className="text-sm text-amber-700">Rescheduled to: {new Date(n.rescheduledDate).toLocaleDateString()}</p>
                              )}
                              {n.status === 'accepted' && <p className="text-sm text-green-700">Accepted – session started</p>}
                            </div>
                            {n.status === 'pending' && (
                              <div className="flex flex-col gap-2">
                                <button
                                  type="button"
                                  disabled={notifActionLoading === n._id}
                                  onClick={async () => {
                                    setNotifActionLoading(n._id);
                                    try {
                                      const token = await getToken();
                                      await api.doctors.acceptNotification(token, n._id);
                                      const data = await api.doctors.notifications(token);
                                      setNotificationsList(Array.isArray(data) ? data : []);
                                      const countsRes = await api.doctors.dashboardCounts(token);
                                      setCounts(c => ({ ...c, unreadNotifications: countsRes.unreadNotifications }));
                                    } finally {
                                      setNotifActionLoading(null);
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setRescheduleId(n._id); setRescheduleDate(''); }}
                                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-100"
                                >
                                  Reschedule
                                </button>
                              </div>
                            )}
                          </div>
                          {rescheduleId === n._id && (
                            <div className="mt-3 flex gap-2 items-center">
                              <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!rescheduleDate) return;
                                  setNotifActionLoading(n._id);
                                  try {
                                    const token = await getToken();
                                    await api.doctors.rescheduleNotification(token, n._id, { rescheduledDate: new Date(rescheduleDate).toISOString() });
                                    const data = await api.doctors.notifications(token);
                                    setNotificationsList(Array.isArray(data) ? data : []);
                                    setRescheduleId(null);
                                    setRescheduleDate('');
                                    const countsRes = await api.doctors.dashboardCounts(token);
                                    setCounts(c => ({ ...c, unreadNotifications: countsRes.unreadNotifications }));
                                  } finally {
                                    setNotifActionLoading(null);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm"
                              >
                                Confirm
                              </button>
                              <button type="button" onClick={() => { setRescheduleId(null); setRescheduleDate(''); }} className="text-slate-500 text-sm">Cancel</button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {/* Patient search result (Doctor side) */}
              {view === 'dashboard' && patient && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {(() => {
                    const accessStatus = patient?.accessStatus || 'none'; // none | pending | approved | rejected
                    const isApproved = accessStatus === 'approved';

                    return (
                      <>
                        {/* Basic patient info always visible */}
                        <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <h2 className="text-lg font-semibold text-slate-800">
                                {t('patientDetails')}
                              </h2>
                              <p className="text-sm text-slate-500 mt-1">
                                <span className="font-mono">{patient.patientId}</span> · {patient.name}, {patient.age}
                              </p>
                            </div>

                            {/* Access CTA / states – session-based: only approved = access */}
                            <div className="min-w-[220px]">
                              {(accessStatus === 'none' || accessStatus === 'rejected') && (
                                <>
                                  {accessStatus === 'rejected' && (
                                    <p className="text-xs text-slate-500 mb-2">Previous request was denied. You can request again.</p>
                                  )}
                                  <Button
                                    onClick={handleRequestAccess}
                                    loading={accessActionLoading}
                                    disabled={accessActionLoading || accessStatus === 'pending'}
                                    className="w-full bg-blue-600 hover:bg-blue-700 rounded-xl"
                                  >
                                    Request Access
                                  </Button>
                                  {accessActionMessage && (
                                    <p className="text-xs text-emerald-700 mt-2">{accessActionMessage}</p>
                                  )}
                                  {accessActionError && (
                                    <p className="text-xs text-red-600 mt-2">{accessActionError}</p>
                                  )}
                                </>
                              )}
                              {accessStatus === 'pending' && (
                                <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 text-sm">
                                  Waiting for patient approval
                                </div>
                              )}
                              {accessStatus === 'approved' && (
                                <div className="w-full flex flex-col gap-2">
                                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm">
                                    Access approved · Session active
                                  </div>
                                  <Button
                                    onClick={async () => {
                                      try {
                                        const token = await getToken();
                                        await api.doctors.closeSession(token, patient.patientId);
                                        const data = await api.doctors.getPatient(token, patient.patientId);
                                        setPatient(data);
                                      } catch {
                                        // ignore
                                      }
                                    }}
                                    className="w-full rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                  >
                                    {t('closeSession')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Only when approved: show full prescription history */}
                          {isApproved ? (
                            <>
                              <div className="flex justify-between items-center mt-4 mb-3">
                                <h3 className="text-base font-semibold text-slate-800">
                                  {t('prescriptionHistory')}
                                </h3>
                                <Button
                                  onClick={() => setShowAddForm(!showAddForm)}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  {t('add') || 'Add'}
                                </Button>
                              </div>
                              <div className="space-y-3">
                                {patient.prescriptions
                                  ?.slice?.()
                                  ?.reverse?.()
                                  ?.map?.((p, i) => (
                                    <PrescriptionCard key={i} prescription={p} />
                                  ))}
                              </div>
                            </>
                          ) : (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                              Prescription history is hidden until the patient approves access.
                            </div>
                          )}
                        </section>

                        {/* Only when approved: enable Add Prescription form */}
                        {isApproved && showAddForm && (
                          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4">
                              Add Prescription
                            </h3>

                            {saveError && (
                              <p className="text-sm text-red-600 mb-2">{saveError}</p>
                            )}

                            <form onSubmit={handleSavePrescription} className="space-y-4">
                              <Input
                                label="Disease"
                                placeholder="e.g. Diabetes"
                                value={disease}
                                onChange={(e) => setDisease(e.target.value)}
                              />

                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Medicines</label>
                                {medicines.map((m, i) => (
                                  <MedicineInput
                                    key={i}
                                    index={i}
                                    medicine={m}
                                    onUpdate={updateMedicine}
                                    onRemove={removeMedicine}
                                    t={t}
                                  />
                                ))}

                                <button
                                  type="button"
                                  onClick={addMedicineRow}
                                  className="mt-2 text-sm text-blue-600 hover:underline"
                                >
                                  + {t('addMedicine')}
                                </button>
                              </div>


                              <Button
                                type="submit"
                                loading={saveLoading}
                                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700"
                              >
                                {t('savePrescription')}
                              </Button>
                            </form>
                          </section>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <MobileBottomNavigation
        role="doctor"
        activeTab={view}
        onNavigate={setView}
        onOpenProfile={() => setProfileDrawerOpen(true)}
      />
    </div>
  );
}
