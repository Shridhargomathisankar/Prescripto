import { useLanguage } from '../contexts/LanguageContext';

export default function ProfileDrawer({ open, onClose, user, onEditProfile, onOpenSettings, onLogout }) {
  const { t } = useLanguage();

  if (!open) return null;

  const role = user?.role || 'user';
  const roleLabel = role.toUpperCase();
  const name = user?.name || 'User';
  const phone = user?.phone || '—';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-in-out">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-base font-semibold text-slate-800">Profile & Account</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* User Card */}
        <div className="p-6 flex flex-col items-center border-b border-slate-100 bg-gradient-to-b from-blue-50/50 to-white">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-teal-500 text-white font-bold text-2xl flex items-center justify-center shadow-md mb-3">
            {initial}
          </div>
          <h3 className="text-lg font-bold text-slate-800">{name}</h3>
          <p className="text-sm text-slate-500 font-mono mb-2">{phone}</p>
          <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold tracking-wider">
            {roleLabel}
          </span>
        </div>

        {/* User Details Section */}
        <div className="flex-1 p-6 space-y-4 overflow-y-auto">
          {role === 'patient' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Patient ID</span>
                <span className="font-mono text-slate-800 font-semibold">{user.patientId || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Age</span>
                <span className="text-slate-800">{user.age ? `${user.age} yrs` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Blood Group</span>
                <span className="text-slate-800">{user.bloodGroup || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Location</span>
                <span className="text-slate-800">{user.location || '—'}</span>
              </div>
            </div>
          )}

          {role === 'doctor' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Clinic</span>
                <span className="text-slate-800 font-medium">{user.clinicName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Specialization</span>
                <span className="text-slate-800">{user.specialization || 'General'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Experience</span>
                <span className="text-slate-800">{user.experience ? `${user.experience} yrs` : '—'}</span>
              </div>
            </div>
          )}

          {role === 'pharmacy' && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Pharmacy Name</span>
                <span className="text-slate-800 font-medium">{user.pharmacyName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Location</span>
                <span className="text-slate-800">{user.location || '—'}</span>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onEditProfile) onEditProfile();
              }}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center justify-between transition"
            >
              <span className="flex items-center gap-3">
                <span>✏️</span> Edit Profile Details
              </span>
              <span>→</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenSettings) onOpenSettings();
              }}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 flex items-center justify-between transition"
            >
              <span className="flex items-center gap-3">
                <span>⚙️</span> Account Settings
              </span>
              <span>→</span>
            </button>
          </div>
        </div>

        {/* Logout Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
            className="w-full px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold flex items-center justify-center gap-2 transition"
          >
            <span>🚪</span> {t('logout') || 'Logout'}
          </button>
        </div>
      </div>
    </div>
  );
}
