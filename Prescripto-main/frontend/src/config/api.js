import { auth } from './firebase';

const API_BASE = '/api';

async function request(path, options = {}) {
  const { token, ...rest } = options;
  const isProtected = !path.startsWith('/auth/');
  let resolvedToken = token || null;
  if (!resolvedToken && isProtected && auth.currentUser) {
    try {
      resolvedToken = await auth.currentUser.getIdToken(true);
    } catch {
      resolvedToken = null;
    }
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(resolvedToken && { Authorization: `Bearer ${resolvedToken}` }),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...rest, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || res.statusText);
  return data;
}

export const api = {
  auth: {
    verify: (idToken) =>
      request('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      }),
    registerPatient: (body) =>
      request('/auth/register-patient', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    registerDoctor: (body) =>
      request('/auth/register-doctor', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    registerPharmacy: (body) =>
      request('/auth/register-pharmacy', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    registerPharmacyEmail: (body) =>
      request('/auth/register-pharmacy-email', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },

  patients: {
    me: (token) => request('/patients/me', { token }),
    updateMe: (token, body) =>
      request('/patients/me', {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      }),
    addReport: (token, body) =>
      request('/patients/me/reports', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    getAccessRequests: (token) =>
      request('/patients/access-requests', { token }),
    acceptAccessRequest: (token, doctorId) =>
      request(
        `/patients/access-requests/${encodeURIComponent(doctorId)}/accept`,
        {
          method: 'POST',
          token,
        }
      ),
    rejectAccessRequest: (token, doctorId) =>
      request(
        `/patients/access-requests/${encodeURIComponent(doctorId)}/reject`,
        {
          method: 'POST',
          token,
        }
      ),
    consultAgain: (token, body) =>
      request('/patients/consult-again', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    consultRequests: (token) =>
      request('/patients/consult-requests', { token }),
    notifications: (token) =>
      request('/patients/notifications', { token }),
    addNotification: (token, body) =>
      request('/patients/notifications', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    markNotificationRead: (token, id) =>
      request(`/patients/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        token,
      }),
    pharmacyAvailability: (token, params) =>
      request(
        `/patients/pharmacy-availability?prescriptionId=${encodeURIComponent(
          params.prescriptionId
        )}&medicineName=${encodeURIComponent(params.medicineName)}&days=${encodeURIComponent(params.days)}`,
        { token }
      ),
    pharmacyAvailabilityMulti: (token, body) =>
      request('/patients/pharmacy-availability-multi', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    createMedicineRequest: (token, body) =>
      request('/patients/medicine-requests', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    medicineRequests: (token) => request('/patients/medicine-requests', { token }),
    reorderMedicineRequest: (token, requestId) =>
      request(`/patients/medicine-requests/${encodeURIComponent(requestId)}/reorder`, {
        method: 'POST',
        token,
      }),
  },

  voice: {
    stt: (formData) =>
      fetch('/api/voice/stt', {
        method: 'POST',
        body: formData,
      }).then(res => {
        if (!res.ok) throw new Error('STT failed');
        return res.json();
      }),
    intent: (token, text) =>
      request('/voice/intent', {
        method: 'POST',
        token,
        body: JSON.stringify({ text }),
      }),
  },
  

  doctors: {
    me: (token) => request('/doctors/me', { token }),
    updateMe: (token, body) =>
      request('/doctors/me', {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      }),
    dashboardCounts: (token) =>
      request('/doctors/dashboard-counts', { token }),
    getPatient: (token, patientId) =>
      request(`/doctors/patients/${encodeURIComponent(patientId)}`, {
        token,
      }),
    requestAccess: (token, patientId) =>
      request(
        `/doctors/patients/${encodeURIComponent(
          patientId
        )}/request-access`,
        {
          method: 'POST',
          token,
        }
      ),
    addPrescription: (token, patientId, body) =>
      request(
        `/doctors/patients/${encodeURIComponent(
          patientId
        )}/prescriptions`,
        {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        }
      ),
    closeSession: (token, patientId) =>
      request(
        `/doctors/patients/${encodeURIComponent(
          patientId
        )}/close-session`,
        {
          method: 'POST',
          token,
        }
      ),
    patientsList: (token) =>
      request('/doctors/patients-list', { token }),
    prescriptionsList: (token) =>
      request('/doctors/prescriptions-list', { token }),
    notifications: (token) =>
      request('/doctors/notifications', { token }),
    markNotificationRead: (token, id) =>
      request(`/doctors/notifications/${encodeURIComponent(id)}/read`, {
        method: 'POST',
        token,
      }),
    acceptNotification: (token, id) =>
      request(`/doctors/notifications/${encodeURIComponent(id)}/accept`, {
        method: 'POST',
        token,
      }),
    rescheduleNotification: (token, id, body) =>
      request(`/doctors/notifications/${encodeURIComponent(id)}/reschedule`, {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    medicineSuggestions: (q) =>
      request(`/doctors/medicines/suggestions?q=${encodeURIComponent(q)}`),
  },

  pharmacies: {
    me: (token) => request('/pharmacies/me', { token }),
    updateMe: (token, body) =>
      request('/pharmacies/me', {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      }),
    availability: (params) =>
      request(
        `/pharmacies/availability?medicineName=${encodeURIComponent(
          params.medicineName
        )}&quantity=${encodeURIComponent(params.quantity)}`
      ),
    stock: (token) => request('/pharmacies/stock', { token }),
    addStock: (token, body) =>
      request('/pharmacies/stock', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
    updateStock: (token, stockId, body) =>
      request(`/pharmacies/stock/${encodeURIComponent(stockId)}`, {
        method: 'PUT',
        token,
        body: JSON.stringify(body),
      }),
    requests: (token) => request('/pharmacies/requests', { token }),
    markReady: (token, requestId) =>
      request(`/pharmacies/requests/${encodeURIComponent(requestId)}/ready`, {
        method: 'POST',
        token,
      }),
    markDelivered: (token, requestId) =>
      request(`/pharmacies/requests/${encodeURIComponent(requestId)}/delivered`, {
        method: 'POST',
        token,
      }),
  },

  voice: {
    transcribe: async (audioBlob, lang) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      if (lang) formData.append('lang', lang);
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });
      return res.json().catch(() => ({ success: false, error: 'TRANSCRIPTION_ERROR' }));
    },
    intent: (token, text) =>
      request('/voice/intent', {
        method: 'POST',
        token,
        body: JSON.stringify({ text }),
      }),
    chat: (token, body) =>
      request('/voice/chat', {
        method: 'POST',
        token,
        body: JSON.stringify(body),
      }),
  },
};
