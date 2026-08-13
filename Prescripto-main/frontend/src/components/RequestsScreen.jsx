import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export default function RequestsScreen({
  accessRequests = [],
  consultRequests = [],
  medicineRequests = [],
  onAcceptAccessRequest,
  onRejectAccessRequest,
  onNavigateHome,
}) {
  const { t } = useLanguage();
  const [tab, setTab] = useState('pending'); // 'pending' | 'completed'

  const allRequests = [
    ...(accessRequests || []).map((r) => ({
      id: r._id || r.id,
      type: 'Doctor Access Request',
      title: `Access Request from Dr. ${r.doctorId?.name || 'Doctor'}`,
      subtitle: r.doctorId?.clinicName || 'Clinic / Hospital',
      date: r.requestedAt || r.createdAt,
      status: r.status, // pending, approved, rejected, closed
      raw: r,
    })),
    ...(consultRequests || []).map((r) => ({
      id: r._id || r.id,
      type: 'Consultation Request',
      title: `Consultation Request with Dr. ${r.doctorId?.name || 'Doctor'}`,
      subtitle: `Requested Date: ${r.requestedDate ? new Date(r.requestedDate).toLocaleDateString() : '—'}`,
      date: r.createdAt || r.requestedDate,
      status: r.status, // pending, accepted, rescheduled, rejected
      raw: r,
    })),
    ...(medicineRequests || []).map((r) => ({
      id: r._id || r.id,
      type: 'Medicine Request',
      title: `Order from ${r.pharmacyId?.pharmacyName || 'Pharmacy'}`,
      subtitle: `${(r.requestedMedicines || []).length} item(s)`,
      date: r.createdAt,
      status: r.status, // pending, ready, picked_up, delivered, rejected
      raw: r,
    })),
  ];

  const pendingList = allRequests.filter(
    (r) => r.status === 'pending' || r.status === 'rescheduled'
  );
  const completedList = allRequests.filter(
    (r) =>
      r.status === 'approved' ||
      r.status === 'accepted' ||
      r.status === 'ready' ||
      r.status === 'picked_up' ||
      r.status === 'delivered' ||
      r.status === 'closed' ||
      r.status === 'rejected'
  );

  const displayList = tab === 'pending' ? pendingList : completedList;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Requests & Sessions</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage all your active access requests, appointments, and medicine orders
          </p>
        </div>
        {onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            ← Back to Home
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            tab === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Pending Requests ({pendingList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            tab === 'completed'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Completed Requests ({completedList.length})
        </button>
      </div>

      {/* List Content */}
      <div className="space-y-3">
        {displayList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-400 text-sm">
            No {tab} requests found.
          </div>
        ) : (
          displayList.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0 mt-0.5">
                  {item.type.includes('Doctor') ? '🩺' : item.type.includes('Medicine') ? '📦' : '📅'}
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-full">
                    {item.type}
                  </span>
                  <h3 className="font-semibold text-slate-800 text-sm mt-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {item.date ? new Date(item.date).toLocaleString() : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {item.type === 'Doctor Access Request' && item.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        onRejectAccessRequest &&
                        onRejectAccessRequest(item.raw?.doctorId?._id || item.raw?.doctorId?.id || item.raw?.doctorId)
                      }
                      className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onAcceptAccessRequest &&
                        onAcceptAccessRequest(item.raw?.doctorId?._id || item.raw?.doctorId?.id || item.raw?.doctorId)
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
                    >
                      Accept
                    </button>
                  </>
                ) : (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'approved' || item.status === 'accepted' || item.status === 'delivered'
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.status === 'ready'
                        ? 'bg-sky-100 text-sky-700'
                        : item.status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.status ? item.status.toUpperCase() : 'PENDING'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
