import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import { getMedicineSuggestions } from '../utils/medicinesDb.js';

const router = Router();

// 🔒 All doctor routes protected
/**
 * =========================
 * GET /api/doctors/medicines/suggestions
 * =========================
 * Public for quick searchable dropdown
 */
router.get('/medicines/suggestions', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.json([]);
    }
    const suggestions = getMedicineSuggestions(q.trim(), 10);
    return res.json(suggestions);
  } catch (err) {
    return res.status(500).json({ error: err.message, suggestions: [] });
  }
});

router.use(requireAuth);

/**
 * =========================
 * GET /api/doctors/me
 * =========================
 */
router.get('/me', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    return res.json(doctor);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * PUT /api/doctors/me
 * =========================
 * Update profile (name, clinicName, specialization, experience, location)
 * or settings (phone with validation)
 */
router.put('/me', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const allowed = ['name', 'clinicName', 'specialization', 'experience', 'location', 'phone'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] === undefined) continue;
      if (key === 'phone') {
        const normalized = String(req.body.phone).replace(/\D/g, '').slice(-10);
        if (normalized.length !== 10) {
          return res.status(400).json({ error: 'Phone must be 10 digits' });
        }
        updates.phone = normalized;
        continue;
      }
      if (key === 'experience') {
        const val = Number(req.body.experience);
        if (Number.isNaN(val) || val < 0) {
          return res.status(400).json({ error: 'Experience must be a non-negative number' });
        }
        updates.experience = val;
        continue;
      }
      updates[key] = req.body[key];
    }

    if (updates.phone && updates.phone !== req.user.phone) {
      const existing = await Doctor.findOne({ phone: updates.phone });
      if (existing) {
        return res.status(400).json({ error: 'Phone number already registered' });
      }
    }

    const updated = await Doctor.findOneAndUpdate(
      { phone: req.user.phone },
      { $set: updates },
      { new: true, runValidators: true }
    );
    return res.json(updated);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'Phone number already in use' });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * GET /api/doctors/dashboard-counts
 * =========================
 * Real counts: totalPatients, prescriptionsGiven, unreadNotifications
 */
router.get('/dashboard-counts', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const doctorId = doctor._id;
    const doctorIdStr = String(doctorId);

    const getDocIdStr = (d) => {
      if (!d) return '';
      if (typeof d === 'object') return String(d._id || d.id || '');
      return String(d);
    };

    // Unique patients: ever had a session (approved or closed) OR at least one prescription by this doctor
    const allPatients = await Patient.find({});
    const totalPatients = new Set();
    for (const p of allPatients) {
      const hasPrescriptionFromDoctor = (p.prescriptions || []).some(
        (pr) => pr.doctorId && String(pr.doctorId) === doctorIdStr
      );
      const hasApprovedOrClosedSession = (p.accessRequests || []).some(
        (r) => getDocIdStr(r.doctorId) === doctorIdStr && (r.status === 'approved' || r.status === 'accepted' || r.status === 'closed')
      );
      if (hasPrescriptionFromDoctor || hasApprovedOrClosedSession) {
        totalPatients.add(p._id ? String(p._id) : String(p.id));
      }
    }

    // Total prescriptions created by this doctor (across all patients)
    let prescriptionsGiven = 0;
    for (const p of allPatients) {
      const count = (p.prescriptions || []).filter(
        (pr) => pr.doctorId && String(pr.doctorId) === doctorIdStr
      ).length;
      prescriptionsGiven += count;
    }

    const unreadNotifications = (doctor.notifications || []).filter((n) => !n.read).length;

    return res.json({
      totalPatients: totalPatients.size,
      prescriptionsGiven,
      unreadNotifications,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * GET /api/doctors/patients/:patientId
 * =========================
 * Doctor searches patient.
 * accessStatus = 'approved' ONLY when there is an ACTIVE session (approved AND now < autoCloseAt).
 * If session closed/expired → accessStatus = 'none' (UI shows Request Access).
 */
router.get('/patients/:patientId', async (req, res) => {
  try {
    const patientId = req.params.patientId.toUpperCase().trim();

    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const patient = await Patient.findOne({ patientId });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const getDocIdStr = (d) => {
      if (!d) return '';
      if (typeof d === 'object') return String(d._id || d.id || '');
      return String(d);
    };

    const requestsForDoctor = (patient.accessRequests || []).filter(
      (r) => getDocIdStr(r.doctorId) === String(doctor._id)
    );
    const now = new Date();

    let accessStatus = 'none';
    let activeAccess = null;

    for (const r of requestsForDoctor) {
      if (
        (r.status === 'approved' || r.status === 'accepted') &&
        r.autoCloseAt &&
        now < new Date(r.autoCloseAt)
      ) {
        activeAccess = r;
        accessStatus = 'approved';
        break;
      }
    }
    if (accessStatus === 'none') {
      const latest = requestsForDoctor.sort(
        (a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0)
      )[0];
      if (latest) {
        if (latest.status === 'pending') accessStatus = 'pending';
        else if (latest.status === 'rejected') accessStatus = 'rejected';
      }
    }

    const baseResponse = {
      patientId: patient.patientId,
      name: patient.name,
      age: patient.age,
      accessStatus,
      sessionEndedAt: activeAccess ? null : (requestsForDoctor[0] && requestsForDoctor[0].sessionEndedAt) || null,
    };

    if (accessStatus === 'approved') {
      baseResponse.prescriptions = patient.prescriptions;
      baseResponse.autoCloseAt = activeAccess.autoCloseAt;
    }

    return res.json(baseResponse);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/doctors/patients/:patientId/request-access
 * =========================
 * New visit = new request. If latest request is closed/rejected/expired, allow new pending request.
 */
router.post('/patients/:patientId/request-access', async (req, res) => {
  try {
    const patientId = req.params.patientId.toUpperCase().trim();

    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const patient = await Patient.findOne({ patientId });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    console.log(`[ACCESS REQUEST] Doctor ${doctor.name} (${doctor._id}) requesting access for patientId=${patientId}`);

    const getDocIdStr = (d) => {
      if (!d) return '';
      if (typeof d === 'object') return String(d._id || d.id || '');
      return String(d);
    };

    const requestsForDoctor = (patient.accessRequests || []).filter(
      (r) => getDocIdStr(r.doctorId) === String(doctor._id)
    );
    const now = new Date();

    const hasPending = requestsForDoctor.some((r) => r.status === 'pending');
    if (hasPending) {
      return res.json({
        status: 'pending',
        message: 'Access request already sent',
      });
    }

    const hasActiveApproved = requestsForDoctor.some(
      (r) =>
        (r.status === 'approved' || r.status === 'accepted') &&
        r.autoCloseAt &&
        now < new Date(r.autoCloseAt)
    );
    if (hasActiveApproved) {
      return res.json({
        status: 'approved',
        message: 'Session already active',
      });
    }

    patient.accessRequests.push({
      doctorId: doctor._id,
      status: 'pending',
      requestedAt: new Date(),
    });

    patient.notifications = patient.notifications || [];
    patient.notifications.push({
      type: 'ACCESS_REQUEST',
      title: 'Doctor access request',
      message: `Dr. ${doctor.name} is requesting access to your records.`,
      meta: {
        doctorId: doctor._id,
        doctorName: doctor.name,
        clinicName: doctor.clinicName || '',
        status: 'pending',
      },
      read: false,
      createdAt: new Date(),
    });

    await patient.save();

    return res.json({
      status: 'pending',
      message: 'Access request sent to patient',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/doctors/patients/:patientId/prescriptions
 * =========================
 * Add prescription ONLY if session active
 */
router.post('/patients/:patientId/prescriptions', async (req, res) => {
  try {
    const patientId = req.params.patientId.toUpperCase().trim();
    const { disease, medicines } = req.body;

    if (!disease || !Array.isArray(medicines) || !medicines.length) {
      return res.status(400).json({
        error: 'disease and medicines array required',
      });
    }

    // Validate each medicine has durationInDays
    for (const m of medicines) {
      if (!m.name || !m.durationInDays || isNaN(Number(m.durationInDays)) || Number(m.durationInDays) <= 0) {
        return res.status(400).json({ error: 'Each medicine must have name and durationInDays > 0' });
      }
    }

    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const patient = await Patient.findOne({ patientId });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const now = new Date();
    const access = patient.accessRequests.find(
      (r) =>
        r.doctorId.toString() === doctor._id.toString() &&
        r.status === 'approved' &&
        r.autoCloseAt &&
        now < new Date(r.autoCloseAt)
    );

    if (!access) {
      return res.status(403).json({
        error: 'No active session. Session may have ended. Please request access again.',
      });
    }

    const prescription = {
      disease,
      medicines: medicines.map((m) => ({
        name: m.name,
        dosage: m.dosage || '',
        morning: !!m.morning,
        afternoon: !!m.afternoon,
        evening: !!m.evening,
        night: !!m.night,
        durationInDays: Number(m.durationInDays),
      })),
      doctorId: doctor._id,
      doctorName: doctor.name,
      clinicName: doctor.clinicName,
    };

    patient.prescriptions.push(prescription);
    await patient.save();

    return res.status(201).json(
      patient.prescriptions[patient.prescriptions.length - 1]
    );
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/doctors/patients/:patientId/close-session
 * =========================
 * Doctor manually closes session: status → closed, sessionEndedAt = now.
 * Access is revoked; next visit requires fresh request + accept.
 */
router.post('/patients/:patientId/close-session', async (req, res) => {
  try {
    const patientId = req.params.patientId.toUpperCase().trim();

    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const patient = await Patient.findOne({ patientId });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const now = new Date();
    const access = patient.accessRequests.find(
      (r) =>
        r.doctorId.toString() === doctor._id.toString() &&
        r.status === 'approved' &&
        r.autoCloseAt &&
        now < new Date(r.autoCloseAt)
    );

    if (!access) {
      return res.status(404).json({ error: 'No active session found' });
    }

    access.status = 'closed';
    access.sessionEndedAt = now;

    if (
      patient.activeSession &&
      patient.activeSession.doctorId &&
      patient.activeSession.doctorId.toString() === doctor._id.toString()
    ) {
      patient.activeSession = null;
    }

    // Patient notification: session closed
    patient.notifications = patient.notifications || [];
    patient.notifications.push({
      type: 'session',
      title: 'Session closed',
      message: `Your session with Dr. ${doctor.name} has been closed.`,
      meta: { doctorId: doctor._id, doctorName: doctor.name, reason: 'manual' },
    });

    await patient.save();

    return res.json({ message: 'Session closed successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * GET /api/doctors/patients-list
 * =========================
 * List patients this doctor has ever consulted (ever had approved/closed session + prescription)
 */
router.get('/patients-list', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    const doctorId = doctor._id;
    const doctorIdStr = String(doctorId);
    const now = new Date();

    const getDocIdStr = (d) => {
      if (!d) return '';
      if (typeof d === 'object') return String(d._id || d.id || '');
      return String(d);
    };

    const allPatients = await Patient.find({}).lean();
    console.log(`[DOCTOR PATIENTS FETCH] Doctor phone=${req.user.phone} fetching patients list. Total DB patients=${allPatients.length}`);

    const list = [];
    for (const p of allPatients) {
      const requests = (p.accessRequests || []).filter(
        (r) => getDocIdStr(r.doctorId) === doctorIdStr
      );
      const hasRx = (p.prescriptions || []).some(
        (pr) => pr.doctorId && String(pr.doctorId) === doctorIdStr
      );

      let accessStatus = 'none';
      for (const r of requests) {
        if (
          (r.status === 'approved' || r.status === 'accepted') &&
          r.autoCloseAt &&
          now < new Date(r.autoCloseAt)
        ) {
          accessStatus = 'approved';
          break;
        }
      }

      if (accessStatus === 'none' && requests.length) {
        const latest = requests.sort(
          (a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0)
        )[0];
        if (latest.status === 'pending') accessStatus = 'pending';
        else if (latest.status === 'rejected') accessStatus = 'rejected';
      }

      // Return patient if access is approved or pending, OR doctor has written prescriptions for patient
      if (accessStatus === 'approved' || accessStatus === 'pending' || hasRx) {
        list.push({
          patientId: p.patientId,
          name: p.name,
          age: p.age,
          accessStatus,
          activeSession: { status: accessStatus === 'approved' ? 'active' : 'none' },
        });
      }
    }

    console.log(`[DOCTOR PATIENTS FETCH] Returned ${list.length} patient(s) for doctor ${doctorIdStr}`);
    return res.json(list);
  } catch (err) {
    console.error('[DOCTOR PATIENTS FETCH ERROR]:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * GET /api/doctors/prescriptions-list
 * =========================
 * List all prescriptions created by this doctor
 */
router.get('/prescriptions-list', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    const doctorId = doctor._id;

    const patients = await Patient.find({}).select('patientId name prescriptions').lean();
    const items = [];
    for (const p of patients) {
      const rxList = (p.prescriptions || []).filter(
        (pr) => pr.doctorId && pr.doctorId.toString() === doctorId.toString()
      );
      for (const pr of rxList) {
        items.push({
          ...pr,
          patientId: p.patientId,
          patientName: p.name,
        });
      }
    }
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json(items);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * GET /api/doctors/notifications
 * =========================
 */
router.get('/notifications', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    const list = (doctor.notifications || []).slice().reverse();
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/doctors/notifications/:id/read
 * =========================
 */
router.post('/notifications/:id/read', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    const notifId = req.params.id;
    const notif = (doctor.notifications || []).find(
      (n) => n._id && n._id.toString() === notifId
    );
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    notif.read = true;
    await doctor.save();
    return res.json(doctor.notifications);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/doctors/notifications/:id/accept
 * =========================
 * Accept consult-again request → start new active session for that patient
 */
router.post('/notifications/:id/accept', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    const notifId = req.params.id;
    const notif = (doctor.notifications || []).find(
      (n) => n._id && n._id.toString() === notifId
    );
    if (!notif || notif.status !== 'pending') {
      return res.status(400).json({ error: 'Notification not found or already handled' });
    }

    const patient = await Patient.findById(notif.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    notif.status = 'accepted';
    notif.read = true;
    await doctor.save();

    patient.activeSession = {
      doctorId: doctor._id,
      status: 'active',
      startedAt: new Date(),
    };
    await patient.save();

    const reqIndex = (patient.consultRequests || []).findIndex(
      (r) => r.doctorId.toString() === doctor._id.toString()
    );
    if (reqIndex !== -1) {
      patient.consultRequests[reqIndex].status = 'accepted';
      await patient.save();
    }

    // Patient notification: doctor accepted
    if (patient) {
      patient.notifications = patient.notifications || [];
      patient.notifications.push({
        type: 'consult',
        title: 'Doctor accepted consultation',
        message: `Dr. ${doctor.name} accepted your consultation request.`,
        meta: { doctorId: doctor._id, doctorName: doctor.name, status: 'accepted' },
      });
      await patient.save();
    }

    return res.json({ message: 'Consultation accepted. Session started.', notification: notif });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/doctors/notifications/:id/reschedule
 * =========================
 * Body: { rescheduledDate: ISO date string }
 */
router.post('/notifications/:id/reschedule', async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ phone: req.user.phone });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }
    const notifId = req.params.id;
    const notif = (doctor.notifications || []).find(
      (n) => n._id && n._id.toString() === notifId
    );
    if (!notif || notif.status !== 'pending') {
      return res.status(400).json({ error: 'Notification not found or already handled' });
    }

    const { rescheduledDate } = req.body;
    const newDate = rescheduledDate ? new Date(rescheduledDate) : null;
    if (!newDate || Number.isNaN(newDate.getTime())) {
      return res.status(400).json({ error: 'Valid rescheduledDate required' });
    }

    notif.status = 'rescheduled';
    notif.rescheduledDate = newDate;
    notif.read = true;
    await doctor.save();

    const patient = await Patient.findById(notif.patientId);
    if (patient && patient.consultRequests) {
      const cr = patient.consultRequests.find(
        (r) => r.doctorId.toString() === doctor._id.toString()
      );
      if (cr) {
        cr.status = 'rescheduled';
        cr.rescheduledDate = newDate;
      }
    }

    if (patient) {
      patient.notifications = patient.notifications || [];
      patient.notifications.push({
        type: 'consult',
        title: 'Doctor rescheduled consultation',
        message: `Dr. ${doctor.name} suggested a new date: ${newDate.toLocaleDateString()}.`,
        meta: { doctorId: doctor._id, doctorName: doctor.name, status: 'rescheduled', rescheduledDate: newDate },
      });
      await patient.save();
    }

    return res.json({ message: 'Rescheduled.', notification: notif });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
