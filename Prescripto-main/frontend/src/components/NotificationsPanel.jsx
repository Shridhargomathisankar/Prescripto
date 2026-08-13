import { useLanguage } from '../contexts/LanguageContext';

export default function NotificationsPanel({ open, onClose, notifications = [], onMarkRead }) {
  const { t } = useLanguage();

  if (!open) return null;

  const unreadList = (notifications || []).filter((n) => !n.read);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden sm:absolute sm:inset-auto sm:right-12 sm:top-14">
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs sm:hidden"
        onClick={onClose}
      />

      {/* Container: Mobile Bottom Sheet (< sm) / Desktop Dropdown (>= sm) */}
      <div className="fixed inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl bg-white shadow-2xl border-t border-slate-200 flex flex-col z-50 sm:relative sm:inset-auto sm:w-96 sm:rounded-2xl sm:border sm:border-slate-200/80 sm:shadow-xl animate-in slide-in-from-bottom-4 sm:animate-in sm:fade-in sm:slide-in-from-top-2 duration-200">
        {/* Mobile Pull Indicator */}
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2 sm:hidden" />

        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 text-sm">{t('notifications') || 'Notifications'}</h3>
            {unreadList.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                {unreadList.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm transition"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="max-h-80 sm:max-h-80 overflow-y-auto divide-y divide-slate-100 p-1">
          {!notifications || notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              {t('noNotifications') || 'No notifications yet'}
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n._id || n.id}
                className={`p-3.5 flex items-start gap-3 rounded-xl transition ${
                  !n.read ? 'bg-blue-50/50 font-medium' : 'hover:bg-slate-50'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm shrink-0 mt-0.5 min-h-[36px] min-w-[36px]">
                  🔔
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">
                    {n.title || n.patientName || 'Notification'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                    {n.message || (n.requestedDate ? `Consultation requested for ${new Date(n.requestedDate).toLocaleDateString()}` : '')}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                  </p>
                </div>
                {!n.read && onMarkRead && (
                  <button
                    type="button"
                    onClick={() => onMarkRead(n._id || n.id)}
                    className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-[10px] font-bold text-blue-700 shrink-0 min-h-[32px]"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
