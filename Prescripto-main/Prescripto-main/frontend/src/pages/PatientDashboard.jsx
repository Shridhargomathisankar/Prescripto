import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { api } from '../config/api';
import VoiceAssistant from '../components/VoiceAssistant';
import PrescriptionCard from '../components/PrescriptionCard';
import Button from '../components/Button';
import NearbyClinicsView from '../components/NearbyClinics';

function getPrescriptionMaxDays(prescription) {
  return (prescription?.medicines || []).reduce(
    (max, m) => Math.max(max, Number(m?.durationInDays) || 0),
    0
  );
}

function formatRequestStatus(status) {
  if (status === 'ready') return 'Ready';
  if (status === 'picked_up' || status === 'delivered') return 'Delivered';
  return 'Pending';
}

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const { user, authReady, logout, getToken } = useAuth();

  const [view, setView] = useState('home'); // home | prescriptions | reports | profile | settings | maps | medicine-status
  const [patient, setPatient] = useState(null);

  const [accessRequests, setAccessRequests] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const [handledRequestIds, setHandledRequestIds] = useState([]);
  const [consultAgainLoading, setConsultAgainLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [medicineRequests, setMedicineRequests] = useState([]);

  // ⏳ wait till auth restored
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ⛔ not logged in / wrong role
  if (!user || user.role !== 'patient') {
    navigate('/patient/login', { replace: true });
    return null;
  }

  const effectivePatient = patient || user;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || user.role !== 'patient') return;
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const data = await api.patients.me(token);
        if (!cancelled) setPatient(data);
      } catch {
        if (!cancelled) setPatient(user);
      }
    })();
    return () => { cancelled = true; };
  }, [user, getToken]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const prescriptions = useMemo(() => effectivePatient?.prescriptions || [], [effectivePatient?.prescriptions]);
  const reports = useMemo(() => effectivePatient?.reports || [], [effectivePatient?.reports]);
  const consultRequests = useMemo(() => effectivePatient?.consultRequests || [], [effectivePatient?.consultRequests]);
  const unreadNotifications = useMemo(
    () => (notifications || []).filter((n) => !n.read).length,
    [notifications]
  );

  /* Medicine reminders: run only for prescribed duration, at user's reminder times */
  useEffect(() => {
    if (!effectivePatient?.prescriptions?.length) return;
    const rs = effectivePatient.reminderSettings || {};
    const morningTime = rs.morningTime || '10:00';
    const afternoonTime = rs.afternoonTime || '13:00';
    const nightTime = rs.nightTime || '20:00';

    const getActivePrescriptions = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return effectivePatient.prescriptions.filter((pr) => {
        const start = new Date(pr.createdAt);
        start.setHours(0, 0, 0, 0);
        const days = getPrescriptionMaxDays(pr);
        const end = new Date(start);
        end.setDate(end.getDate() + days);
        return today >= start && today <= end;
      });
    };

    const slotToTime = (slot) => {
      if (slot === 'morning') return morningTime;
      if (slot === 'afternoon') return afternoonTime;
      if (slot === 'night') return nightTime;
      return null;
    };

    const getMedicinesForSlot = (slot) => {
      const active = getActivePrescriptions();
      const list = [];
      active.forEach((pr) => {
        (pr.medicines || []).forEach((m) => {
          if (slot === 'night' && (m.night || m.evening)) list.push(m.name);
          else if (m[slot]) list.push(m.name);
        });
      });
      return [...new Set(list)];
    };

    const checkAndNotify = () => {
      const now = new Date();
      const hour = now.getHours();
      const min = now.getMinutes();
      const timeStr = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const dateKey = now.toDateString();
        ['morning', 'afternoon', 'night'].forEach(async (slot) => {
        const t = slotToTime(slot);
        if (t !== timeStr) return;
        const key = `prescripto_reminder_${dateKey}_${slot}`;
        if (typeof localStorage !== 'undefined' && localStorage.getItem(key)) return;
        const names = getMedicinesForSlot(slot);
        if (names.length === 0) return;
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Medicine Reminder', { body: `${slot}: ${names.join(', ')}` });
        }
        try { localStorage.setItem(key, '1'); } catch (_) {}
        try {
          const token = await getToken();
          if (token) {
            await api.patients.addNotification(token, {
              type: 'reminder',
              title: 'Medicine reminder',
              message: `${slot}: ${names.join(', ')}`,
              meta: { slot, medicines: names },
            });
          }
        } catch {
          // ignore notification persistence failure
        }
      });
    };

    const interval = setInterval(checkAndNotify, 60 * 1000);
    checkAndNotify();
    return () => clearInterval(interval);
  }, [effectivePatient?.prescriptions, effectivePatient?.reminderSettings]);

  /* =========================
     Access Requests (popup)
  ========================= */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setAccessLoading(true);
      setAccessError(null);
      try {
        const token = await getToken();
        if (!token) return;
        const data = await api.patients.getAccessRequests(token);
        if (!cancelled) setAccessRequests(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) setAccessError(err.message || 'Failed to load access requests');
      } finally {
        if (!cancelled) setAccessLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const activeRequest = useMemo(
    () =>
      accessRequests.find(
        (r) => r?.doctorId?._id && !handledRequestIds.includes(r.doctorId._id)
      ),
    [accessRequests, handledRequestIds]
  );

  const handleAccessAction = async (action) => {
    if (!activeRequest?.doctorId?._id) return;
    const doctorId = activeRequest.doctorId._id;
    setHandledRequestIds((prev) => [...prev, doctorId]);
    try {
      const token = await getToken();
      if (!token) return;
      if (action === 'accept') {
        await api.patients.acceptAccessRequest(token, doctorId);
      } else {
        await api.patients.rejectAccessRequest(token, doctorId);
      }
      // Refresh list so popup does not reappear
      const data = await api.patients.getAccessRequests(token);
      setAccessRequests(Array.isArray(data) ? data : []);
    } catch {
      // silent fail for UI-only, backend already enforces logic
    }
  };

  /* =========================
     Patient notifications (bell)
  ========================= */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const [notifData, requestData] = await Promise.all([
          api.patients.notifications(token),
          api.patients.medicineRequests(token),
        ]);
        if (!cancelled) {
          setNotifications(Array.isArray(notifData) ? notifData : []);
          setMedicineRequests(Array.isArray(requestData) ? requestData : []);
        }
      } catch {
        if (!cancelled) {
          setNotifications([]);
          setMedicineRequests([]);
        }
      }
    };
    load();
    const id = setInterval(load, 20000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [getToken]);

  /* =========================
     Derived sections
  ========================= */
  const handleConsultAgain = async (prescription) => {
    const doctorId = prescription.doctorId?._id || prescription.doctorId;
    if (!doctorId) return;
    setConsultAgainLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.patients.consultAgain(token, { doctorId, requestedDate: new Date().toISOString() });
      const data = await api.patients.me(token);
      setPatient(data);
    } catch {
      // silent
    } finally {
      setConsultAgainLoading(false);
    }
  };

  const recentPrescriptions = useMemo(
    () => prescriptions.slice().reverse().slice(0, 2),
    [prescriptions]
  );

  const recentReports = useMemo(
    () => reports.slice().reverse().slice(0, 2),
    [reports]
  );

  const renderHome = () => (
    <>
      {/* Welcome banner & cards layout (matches reference) */}
      <section className="bg-gradient-to-r from-teal-500 to-sky-500 rounded-3xl px-5 py-5 text-white shadow-lg">
        <p className="text-xs uppercase tracking-wide opacity-90 mb-1">
          {t('welcome') || 'Welcome'}
        </p>
        <h1 className="text-xl font-semibold mb-1">
          {effectivePatient?.name}
        </h1>
        <p className="text-xs text-teal-50">
          ID:&nbsp;
          <span className="font-mono font-medium bg-white/10 rounded px-2 py-0.5">
            {effectivePatient?.patientId}
          </span>
        </p>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* My Prescriptions */}
        <button
          type="button"
          onClick={() => setView('prescriptions')}
          className="bg-white rounded-2xl shadow-sm border border-sky-100 px-4 py-4 text-left hover:shadow-md transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <span className="text-lg">💊</span>
            </div>
            <span className="text-xs font-medium text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
              {prescriptions.length}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-1">
            {t('prescriptions')}
          </p>
          <p className="text-xs text-slate-500">
            View your doctor prescriptions.
          </p>
        </button>

        {/* Scan & Reports */}
        <button
          type="button"
          onClick={() => setView('reports')}
          className="bg-white rounded-2xl shadow-sm border border-blue-100 px-4 py-4 text-left hover:shadow-md transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <span className="text-lg">🧾</span>
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {reports.length}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-1">
            {t('scanReports')}
          </p>
          <p className="text-xs text-slate-500">
            Access your lab and scan files.
          </p>
        </button>

        {/* Medicine reminders */}
        <button
          type="button"
          onClick={() => setView('settings')}
          className="bg-slate-50 rounded-2xl border border-teal-100 px-4 py-4 flex flex-col justify-between text-left"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
              <span className="text-lg">⏰</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">
            {t('medicineReminders')}
          </p>
          <p className="text-xs text-slate-500">
            {t('remindersPlaceholder')}
          </p>
        </button>

        {/* Consult again */}
        <button
          type="button"
          onClick={() => setView('prescriptions')}
          className="bg-white rounded-2xl shadow-sm border border-amber-100 px-4 py-4 text-left hover:shadow-md transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <span className="text-lg">🔁</span>
            </div>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {consultRequests.length}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-1">
            {t('consultAgain')}
          </p>
          <p className="text-xs text-slate-500">
            {t('consultAgainDescription') || 'Request to consult your doctor again.'}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setView('medicine-status')}
          className="bg-white rounded-2xl shadow-sm border border-violet-100 px-4 py-4 text-left hover:shadow-md transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <span className="text-lg">+</span>
            </div>
            <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
              {medicineRequests.length}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-1">
            Medicine Requirement Status
          </p>
          <p className="text-xs text-slate-500">
            Track Pending, Ready, and Delivered medicine requests.
          </p>
        </button>

        {/* Nearby clinics */}
        <button
          type="button"
          onClick={() => setView('maps')}
          className="bg-white rounded-2xl shadow-sm border border-emerald-100 px-4 py-4 text-left hover:shadow-md transition flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <span className="text-lg">📍</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-800 mb-1">
            {t('findNearbyClinics')}
          </p>
          <p className="text-xs text-slate-500">
            {t('nearbyClinicsDescription') || 'Search clinics and hospitals near you.'}
          </p>
        </button>
      </section>

      {/* Recent Prescriptions & Reports preview */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            Recent Prescriptions
          </h2>
          {prescriptions.length > 0 && (
            <button
              type="button"
              onClick={() => setView('prescriptions')}
              className="text-xs font-medium text-sky-600 hover:underline"
            >
              View all
            </button>
          )}
        </div>
        {recentPrescriptions.length === 0 ? (
          <p className="text-xs text-slate-500">
            {t('noPrescriptions')}
          </p>
        ) : (
          <div className="space-y-2">
            {recentPrescriptions.map((p, i) => (
              <PrescriptionCard key={i} prescription={p} onConsultAgain={handleConsultAgain} enableMedicineRequest />
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">
            Latest Reports
          </h2>
          {reports.length > 0 && (
            <button
              type="button"
              onClick={() => setView('reports')}
              className="text-xs font-medium text-sky-600 hover:underline"
            >
              View all
            </button>
          )}
        </div>
        {recentReports.length === 0 ? (
          <p className="text-xs text-slate-500">
            {t('noReports')}
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            {recentReports.map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50"
              >
                <span className="text-slate-700 truncate mr-2">{r.name}</span>
                {r.uploadedAt && (
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(r.uploadedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );

  const renderPrescriptions = () => (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-teal-800">
          {t('prescriptions')}
        </h2>
        <button
          type="button"
          onClick={() => setView('home')}
          className="text-xs text-sky-600 hover:underline"
        >
          Back to dashboard
        </button>
      </div>
      {prescriptions.length === 0 ? (
        <p className="text-slate-500">{t('noPrescriptions')}</p>
      ) : (
          prescriptions
          .slice()
          .reverse()
          .map((p, i) => (
            <PrescriptionCard key={i} prescription={p} onConsultAgain={handleConsultAgain} enableMedicineRequest />
          ))
      )}
    </section>
  );

  const renderReports = () => (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-teal-800">
          {t('scanReports')}
        </h2>
        <button
          type="button"
          onClick={() => setView('home')}
          className="text-xs text-sky-600 hover:underline"
        >
          Back to dashboard
        </button>
      </div>
      {reports.length === 0 ? (
        <p className="text-slate-500">{t('noReports')}</p>
      ) : (
        reports.map((r, i) => (
          <div key={i} className="flex justify-between items-center px-3 py-2 rounded-xl bg-slate-50">
            <span className="text-slate-700 truncate mr-2">{r.name}</span>
            {r.uploadedAt && (
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {new Date(r.uploadedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        ))
      )}
    </section>
  );

  const renderMedicineStatus = () => (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-teal-800">Medicine Requirement Status</h2>
        <button
          type="button"
          onClick={() => setView('home')}
          className="text-xs text-sky-600 hover:underline"
        >
          Back to dashboard
        </button>
      </div>

      {medicineRequests.length === 0 ? (
        <p className="text-slate-500 text-sm">No medicine requests yet.</p>
      ) : (
        <div className="space-y-3">
          {medicineRequests.map((req) => (
            <div key={req._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-800">{req.pharmacyId?.pharmacyName || 'Pharmacy'}</p>
                <span className="text-xs font-semibold text-slate-700">{formatRequestStatus(req.status)}</span>
              </div>
              {(req.requestedMedicines || []).map((item) => (
                <div key={`${req._id}-${item.medicineName}`} className="text-xs text-slate-700">
                  <p>{item.medicineName}</p>
                  <p>Requested: {Number(item.requestedDays) || 0} day(s)</p>
                  <p>Purchased: {Number(item.purchasedDays) || 0} day(s)</p>
                  <p>Remaining balance: {Number(item.remainingDays) || 0} day(s)</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );

  const [profileEditing, setProfileEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', age: '', bloodGroup: '', medicalInfo: '', gender: '', location: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (effectivePatient) {
      setProfileForm({
        name: effectivePatient.name || '',
        age: effectivePatient.age ?? '',
        bloodGroup: effectivePatient.bloodGroup || '',
        medicalInfo: effectivePatient.medicalInfo || '',
        gender: effectivePatient.gender || '',
        location: effectivePatient.location || '',
      });
    }
  }, [effectivePatient]);

  const renderProfile = () => (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-teal-800">{t('profile')}</h2>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setView('home')} className="text-xs text-sky-600 hover:underline">{t('backToDashboard')}</button>
          {!profileEditing ? (
            <button type="button" onClick={() => setProfileEditing(true)} className="flex items-center gap-1 text-teal-600 text-sm font-medium">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              {t('edit')}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => setProfileEditing(false)} className="text-slate-600 text-sm">Cancel</button>
              <button
                type="button"
                onClick={async () => {
                  setProfileSaving(true);
                  try {
                    const token = await getToken();
                    if (!token) return;
                    await api.patients.updateMe(token, {
                      name: profileForm.name,
                      age: Number(profileForm.age),
                      bloodGroup: profileForm.bloodGroup || undefined,
                      medicalInfo: profileForm.medicalInfo || undefined,
                      gender: profileForm.gender || undefined,
                      location: profileForm.location || undefined,
                    });
                    const data = await api.patients.me(token);
                    setPatient(data);
                    setProfileEditing(false);
                  } finally {
                    setProfileSaving(false);
                  }
                }}
                disabled={profileSaving}
                className="text-teal-600 text-sm font-medium"
              >
                {profileSaving ? t('saving') : t('save')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('name')}</label>
          <input value={profileForm.name} onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))} readOnly={!profileEditing} className={`w-full px-3 py-2.5 rounded-xl border text-sm ${profileEditing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('age')}</label>
            <input type="number" value={profileForm.age} onChange={(e) => setProfileForm((f) => ({ ...f, age: e.target.value }))} readOnly={!profileEditing} className={`w-full px-3 py-2.5 rounded-xl border text-sm ${profileEditing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">{t('bloodGroup')}</label>
            <input value={profileForm.bloodGroup} onChange={(e) => setProfileForm((f) => ({ ...f, bloodGroup: e.target.value }))} readOnly={!profileEditing} className={`w-full px-3 py-2.5 rounded-xl border text-sm ${profileEditing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('gender')}</label>
          <input value={profileForm.gender} onChange={(e) => setProfileForm((f) => ({ ...f, gender: e.target.value }))} readOnly={!profileEditing} placeholder={t('gender')} className={`w-full px-3 py-2.5 rounded-xl border text-sm ${profileEditing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('location')}</label>
          <input value={profileForm.location} onChange={(e) => setProfileForm((f) => ({ ...f, location: e.target.value }))} readOnly={!profileEditing} placeholder={t('location')} className={`w-full px-3 py-2.5 rounded-xl border text-sm ${profileEditing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">{t('medicalInfo')}</label>
          <textarea value={profileForm.medicalInfo} onChange={(e) => setProfileForm((f) => ({ ...f, medicalInfo: e.target.value }))} readOnly={!profileEditing} rows={3} className={`w-full px-3 py-2.5 rounded-xl border text-sm resize-none ${profileEditing ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`} />
        </div>
      </div>
    </section>
  );

  const [reminderSettings, setReminderSettings] = useState({
    morningTime: '10:00',
    afternoonTime: '13:00',
    nightTime: '20:00',
    reminderType: 'notification',
    alarmTone: 'default',
    messageTone: 'default',
  });
  const [reminderSaving, setReminderSaving] = useState(false);

  useEffect(() => {
    const rs = effectivePatient?.reminderSettings;
    if (rs) {
      setReminderSettings({
        morningTime: rs.morningTime || '10:00',
        afternoonTime: rs.afternoonTime || '13:00',
        nightTime: rs.nightTime || '20:00',
        reminderType: rs.reminderType || 'notification',
        alarmTone: rs.alarmTone || 'default',
        messageTone: rs.messageTone || 'default',
      });
    }
  }, [effectivePatient?.reminderSettings]);

  const saveReminderSettings = async () => {
    setReminderSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      await api.patients.updateMe(token, { reminderSettings });
      const data = await api.patients.me(token);
      setPatient(data);
    } finally {
      setReminderSaving(false);
    }
  };

  const renderSettings = () => (
    <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-teal-800">{t('settings')}</h2>
        <button type="button" onClick={() => setView('home')} className="text-xs text-sky-600 hover:underline">{t('backToDashboard')}</button>
      </div>

      <div className="space-y-4 text-sm">
        <h3 className="font-medium text-slate-800">{t('medicineReminders')} – {t('customizeTimes') || 'Customize times'}</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('morning')}</label>
            <input type="time" value={reminderSettings.morningTime} onChange={(e) => setReminderSettings((s) => ({ ...s, morningTime: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('afternoon')}</label>
            <input type="time" value={reminderSettings.afternoonTime} onChange={(e) => setReminderSettings((s) => ({ ...s, afternoonTime: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('night')}</label>
            <input type="time" value={reminderSettings.nightTime} onChange={(e) => setReminderSettings((s) => ({ ...s, nightTime: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t('reminderType') || 'Reminder type'}</label>
          <select value={reminderSettings.reminderType} onChange={(e) => setReminderSettings((s) => ({ ...s, reminderType: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200">
            <option value="notification">{t('notificationMessage') || 'Notification message'}</option>
            <option value="alarm">{t('alarmSound') || 'Alarm sound'}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t('alarmTone') || 'Alarm tone'}</label>
          <select value={reminderSettings.alarmTone} onChange={(e) => setReminderSettings((s) => ({ ...s, alarmTone: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200">
            <option value="default">Default</option>
            <option value="soft">Soft</option>
            <option value="gentle">Gentle</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">{t('messageTone') || 'Message tone'}</label>
          <select value={reminderSettings.messageTone} onChange={(e) => setReminderSettings((s) => ({ ...s, messageTone: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-slate-200">
            <option value="default">Default</option>
            <option value="soft">Soft</option>
            <option value="gentle">Gentle</option>
          </select>
        </div>
        <Button onClick={saveReminderSettings} loading={reminderSaving} className="w-full rounded-xl bg-teal-600 hover:bg-teal-700">{t('save')}</Button>

        {typeof Notification !== 'undefined' && Notification.permission === 'default' && (
          <button type="button" onClick={() => Notification.requestPermission()} className="w-full py-2 text-sm text-teal-600 border border-teal-200 rounded-xl">{t('enableReminders') || 'Enable notification reminders'}</button>
        )}
      </div>
    </section>
  );

  const renderMapsSearch = () => <NearbyClinicsView onBack={() => setView('home')} patientLocation={effectivePatient?.location} t={t} />;

  const renderBody = () => {
    switch (view) {
      case 'prescriptions':
        return renderPrescriptions();
      case 'reports':
        return renderReports();
      case 'profile':
        return renderProfile();
      case 'settings':
        return renderSettings();
      case 'maps':
        return renderMapsSearch();
      case 'medicine-status':
        return renderMedicineStatus();
      case 'home':
      default:
        return renderHome();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold text-sm">
              {effectivePatient?.name ? effectivePatient.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">
                {t('dashboard')}
              </h1>
              <p className="text-xs text-slate-600">
                {t('patientId')}:{" "}
                <span className="font-mono font-medium">
                  {effectivePatient?.patientId}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setBellOpen((o) => !o)}
                className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 relative"
                aria-label={t('consultRequests')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 6h.01M9 17h.01" /></svg>
                {unreadNotifications > 0 && (
                  <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-xs font-medium text-white bg-teal-500 rounded-full">{unreadNotifications}</span>
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} aria-hidden="true" />
                  <div className="absolute right-0 top-full mt-1 w-72 max-w-[90vw] bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-2 max-h-80 overflow-y-auto">
                    <p className="px-3 py-2 text-sm font-medium text-slate-700 border-b border-slate-100">{t('notifications')}</p>
                    {notifications.length === 0 ? (
                      <p className="px-3 py-4 text-sm text-slate-500">{t('noNotifications') || 'No notifications.'}</p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div key={n._id || n.createdAt || n.title} className="px-3 py-2 border-b border-slate-50 last:border-0">
                          <p className="text-sm font-medium text-slate-800">{n.title}</p>
                          <p className="text-xs text-slate-500">
                            {n.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
              aria-label={t('menu')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hamburger menu overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/40">
          <div className="absolute inset-0" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="relative ml-0 w-64 max-w-[85vw] h-full bg-white shadow-xl flex flex-col pt-6">
            <p className="px-4 text-sm font-semibold text-slate-500 uppercase tracking-wide">{t('menu')}</p>
            <nav className="flex-1 py-4">
              <button type="button" onClick={() => { setView('settings'); setMenuOpen(false); }} className="w-full px-4 py-3 text-left text-slate-800 hover:bg-slate-50 flex items-center gap-3">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {t('settings')}
              </button>
              <button type="button" onClick={() => { setView('maps'); setMenuOpen(false); }} className="w-full px-4 py-3 text-left text-slate-800 hover:bg-slate-50 flex items-center gap-3">
                <span className="text-lg">🔍</span>
                {t('findNearbyClinics')}
              </button>
              <button type="button" onClick={() => { setView('medicine-status'); setMenuOpen(false); }} className="w-full px-4 py-3 text-left text-slate-800 hover:bg-slate-50 flex items-center gap-3">
                <span className="text-lg">+</span>
                Medicine Requirement Status
              </button>
            </nav>
            <div className="border-t border-slate-200 p-4">
              <Button variant="ghost" onClick={handleLogout} className="w-full justify-center text-red-600">{t('logout')}</Button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {renderBody()}
      </main>

      {/* Simple bottom shortcuts for profile/settings */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 py-2 px-6 flex items-center justify-between text-xs text-slate-600">
        <button type="button" onClick={() => setView('home')} className={`flex flex-col items-center gap-0.5 ${view === 'home' ? 'text-teal-600' : ''}`}>
          <span>🏠</span>
          <span>{t('home')}</span>
        </button>
        <button type="button" onClick={() => setView('prescriptions')} className={`flex flex-col items-center gap-0.5 ${view === 'prescriptions' ? 'text-teal-600' : ''}`}>
          <span>💊</span>
          <span>Rx</span>
        </button>
        <button type="button" onClick={() => setView('profile')} className={`flex flex-col items-center gap-0.5 ${view === 'profile' ? 'text-teal-600' : ''}`}>
          <span>👤</span>
          <span>{t('profile')}</span>
        </button>
        <button type="button" onClick={() => setMenuOpen(true)} className={`flex flex-col items-center gap-0.5 ${view === 'settings' ? 'text-teal-600' : ''}`}>
          <span>☰</span>
          <span>{t('menu')}</span>
        </button>
      </nav>

      {/* Access request popup */}
      {activeRequest && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Doctor access request
            </h2>
            <p className="text-sm text-slate-600">
              Dr. <span className="font-medium">{activeRequest.doctorId.name}</span>
              {activeRequest.doctorId.clinicName && (
                <>
                  {' '}
                  from{' '}
                  <span className="font-medium">
                    {activeRequest.doctorId.clinicName}
                  </span>
                </>
              )}{' '}
              is requesting access to your medical records.
            </p>

            {accessError && (
              <p className="text-xs text-red-600">
                {accessError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => handleAccessAction('reject')}
              >
                Reject
              </Button>
              <Button
                onClick={() => handleAccessAction('accept')}
                loading={accessLoading}
              >
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}

      <VoiceAssistant onNavigateView={setView} />
    </div>
  );
}
