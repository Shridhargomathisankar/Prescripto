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

  const formatStatusText = (status) => {
    switch (status) {
      case 'approved':
        return t('statusApproved') || 'APPROVED';
      case 'accepted':
        return t('statusAccepted') || 'ACCEPTED';
      case 'ready':
        return t('statusReady') || 'READY';
      case 'delivered':
        return t('statusDelivered') || 'DELIVERED';
      case 'picked_up':
        return t('pickedUp') || 'PICKED UP';
      case 'pending':
        return t('statusPending') || 'PENDING';
      case 'rejected':
        return t('statusRejected') || 'REJECTED';
      case 'closed':
        return t('statusClosed') || 'CLOSED';
      case 'rescheduled':
        return t('statusRescheduled') || 'RESCHEDULED';
      default:
        return (status || 'PENDING').toUpperCase();
    }
  };

  const getTypeLabel = (typeKey) => {
    switch (typeKey) {
      case 'doctor_access':
        return t('doctorAccessRequest') || 'Doctor Access Request';
      case 'consultation':
        return t('consultationRequest') || 'Consultation Request';
      case 'medicine':
        return t('medicineRequest') || 'Medicine Request';
      default:
        return typeKey;
    }
  };

  const [localStatuses, setLocalStatuses] = useState({});

  const handleAcceptClick = async (item) => {
    const docId = item.raw?.doctorId?._id || item.raw?.doctorId?.id || item.raw?.doctorId;
    const reqId = item.id;
    setLocalStatuses((prev) => ({
      ...prev,
      [reqId]: 'approved',
      [docId]: 'approved',
    }));
    if (onAcceptAccessRequest) {
      await onAcceptAccessRequest(docId);
    }
  };

  const handleRejectClick = async (item) => {
    const docId = item.raw?.doctorId?._id || item.raw?.doctorId?.id || item.raw?.doctorId;
    const reqId = item.id;
    setLocalStatuses((prev) => ({
      ...prev,
      [reqId]: 'rejected',
      [docId]: 'rejected',
    }));
    if (onRejectAccessRequest) {
      await onRejectAccessRequest(docId);
    }
  };

  const allRequests = [
    ...(accessRequests || []).map((r) => ({
      id: r._id || r.id,
      typeKey: 'doctor_access',
      title: `${t('accessRequestFrom') || 'Access Request from'} Dr. ${r.doctorId?.name || 'Doctor'}`,
      subtitle: r.doctorId?.clinicName || 'Clinic / Hospital',
      date: r.requestedAt || r.createdAt,
      status: r.status,
      raw: r,
    })),
    ...(consultRequests || []).map((r) => ({
      id: r._id || r.id,
      typeKey: 'consultation',
      title: `${t('consultationRequestWith') || 'Consultation Request with'} Dr. ${r.doctorId?.name || 'Doctor'}`,
      subtitle: `${t('duration') || 'Requested Date'}: ${r.requestedDate ? new Date(r.requestedDate).toLocaleDateString() : '—'}`,
      date: r.createdAt || r.requestedDate,
      status: r.status,
      raw: r,
    })),
    ...(medicineRequests || []).map((r) => ({
      id: r._id || r.id,
      typeKey: 'medicine',
      title: `${t('orderFrom') || 'Order from'} ${r.pharmacyId?.pharmacyName || 'Pharmacy'}`,
      subtitle: `${(r.requestedMedicines || []).length} ${t('itemCount') || 'item(s)'}`,
      date: r.createdAt,
      status: r.status,
      raw: r,
    })),
  ];

  const getEffectiveStatus = (item) => {
    const reqId = item.id;
    const docId = item.raw?.doctorId?._id || item.raw?.doctorId?.id || item.raw?.doctorId;
    return localStatuses[reqId] || (docId ? localStatuses[docId] : null) || item.status;
  };

  const pendingList = allRequests.filter(
    (r) => getEffectiveStatus(r) === 'pending' || getEffectiveStatus(r) === 'rescheduled'
  );
  const completedList = allRequests.filter((r) => {
    const st = getEffectiveStatus(r);
    return (
      st === 'approved' ||
      st === 'accepted' ||
      st === 'ready' ||
      st === 'picked_up' ||
      st === 'delivered' ||
      st === 'closed' ||
      st === 'rejected'
    );
  });

  const displayList = tab === 'pending' ? pendingList : completedList;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {t('requestsAndSessions') || 'Requests & Sessions'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('requestsAndSessionsDesc') || 'Manage all your active access requests, appointments, and medicine orders'}
          </p>
        </div>
        {onNavigateHome && (
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-xs text-blue-600 hover:underline font-medium"
          >
            {t('backToHome') || '← Back to Home'}
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`pb-3 text-sm font-semibold transition border-b-2 ${
            tab === 'pending'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t('pendingRequests') || 'Pending Requests'} ({pendingList.length})
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
          {t('completedRequests') || 'Completed Requests'} ({completedList.length})
        </button>
      </div>

      {/* List Content */}
      <div className="space-y-3">
        {displayList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-400 text-sm">
            {tab === 'pending'
              ? t('noPendingRequestsFound') || 'No pending requests found.'
              : t('noCompletedRequestsFound') || 'No completed requests found.'}
          </div>
        ) : (
          displayList.map((item) => {
            const st = getEffectiveStatus(item);
            const isApproved = st === 'approved' || st === 'accepted';
            const isRejected = st === 'rejected';

            return (
              <div
                key={`${item.typeKey}-${item.id}`}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0 mt-0.5">
                    {item.typeKey === 'doctor_access' ? '🩺' : item.typeKey === 'medicine' ? '📦' : '📅'}
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded-full">
                      {getTypeLabel(item.typeKey)}
                    </span>
                    <h3 className="font-semibold text-slate-800 text-sm mt-1">{item.title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{item.subtitle}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {item.date ? new Date(item.date).toLocaleString() : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.typeKey === 'doctor_access' && st === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRejectClick(item)}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                      >
                        {t('reject') || 'Reject'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAcceptClick(item)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-xs transition"
                      >
                        {t('accept') || 'Accept'}
                      </button>
                    </>
                  ) : isApproved ? (
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs flex items-center gap-1">
                      ✓ Accepted
                    </span>
                  ) : isRejected ? (
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs flex items-center gap-1">
                      ✕ Rejected
                    </span>
                  ) : (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        st === 'ready'
                          ? 'bg-sky-100 text-sky-700'
                          : st === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {formatStatusText(st)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
