import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import Pharmacy from '../models/Pharmacy.js';
import MedicineRequest from '../models/MedicineRequest.js';

const router = Router();

// 🔒 All patient routes protected
router.use(requireAuth);

/**
 * 🔧 Helper: normalize phone to last 10 digits
 */
function normalizePhone(phone) {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').slice(-10);
}

function normalizeMedicineName(name) {
  return String(name || '').trim().toLowerCase();
}

function calculateDailyDoseCount(medicine) {
  const slots = [medicine?.morning, medicine?.afternoon, medicine?.evening, medicine?.night];
  const count = slots.filter(Boolean).length;
  return count > 0 ? count : 1;
}

function getDeliveredStatuses() {
  return ['picked_up', 'delivered'];
}

function getPurchasedDaysFromRequestItem(item) {
  if (!item) return 0;
  if (Number.isFinite(Number(item.requestedDays)) && Number(item.requestedDays) > 0) {
    return Number(item.requestedDays);
  }
  const dosesPerDay = Number(item.dosesPerDay);
  const quantity = Number(item.quantity);
  if (!Number.isFinite(dosesPerDay) || dosesPerDay <= 0) return 0;
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.floor(quantity / dosesPerDay);
}

function isPrescriptionExpired(prescription) {
  const maxDays = (prescription?.medicines || []).reduce(
    (max, med) => Math.max(max, getMedicinePrescribedDays(med, prescription)),
    0
  );
  if (!prescription?.createdAt || maxDays <= 0) return false;
  const expiry = new Date(prescription.createdAt);
  expiry.setDate(expiry.getDate() + maxDays);
  return new Date() > expiry;
}

function getMedicinePrescribedDays(medicine, prescription) {
  const perMedicine = Number(medicine?.durationInDays);
  if (Number.isFinite(perMedicine) && perMedicine > 0) return perMedicine;
  const legacy = Number.parseInt(String(prescription?.duration || '').replace(/\D/g, ''), 10);
  if (Number.isFinite(legacy) && legacy > 0) return legacy;
  return 7;
}

/**
 * =========================
 * GET /api/patients/me
 * =========================
 */
router.get('/me', async (req, res) => {
  try {
    let phone = req.user.phone;
    if (!phone) {
      return res.status(401).json({ error: 'No phone in token' });
    }

    phone = normalizePhone(phone);

    const patient = await Patient.findOne({ phone })
      .populate({
        path: 'prescriptions.doctorId',
        model: Doctor,
        select: 'name clinicName specialization',
      })
      .populate({
        path: 'accessRequests.doctorId',
        model: Doctor,
        select: 'name clinicName',
      })
      .populate({
        path: 'consultRequests.doctorId',
        model: Doctor,
        select: 'name clinicName',
      });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Calculate purchased and remaining days per medicine for each prescription.
    // Purchased = only delivered/picked-up requests.
    const allRequests = await MedicineRequest.find({
      patientId: patient._id,
      status: { $in: getDeliveredStatuses() },
    }).lean();

    const patientData = patient.toObject();
    for (const prescription of patientData.prescriptions || []) {
      const relevant = allRequests.filter(
        (r) => String(r.prescriptionId) === String(prescription._id)
      );
      for (const med of prescription.medicines || []) {
        const normalizedMedName = normalizeMedicineName(med.name);
        let purchased = 0;
        for (const req of relevant) {
          if (Array.isArray(req.requestedMedicines) && req.requestedMedicines.length > 0) {
            for (const item of req.requestedMedicines) {
              if (normalizeMedicineName(item.medicineName) === normalizedMedName) {
                purchased += getPurchasedDaysFromRequestItem(item);
              }
            }
          } else if (normalizeMedicineName(req.medicineName) === normalizedMedName) {
            purchased += getPurchasedDaysFromRequestItem(req);
          }
        }
        const prescribed = getMedicinePrescribedDays(med, prescription);
        med.purchasedDays = purchased;
        med.remainingDays = Math.max(0, prescribed - purchased);
      }
    }

    return res.json(patientData);
  } catch (err) {
    console.error('patients/me error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * PUT /api/patients/me
 * =========================
 */
router.put('/me', async (req, res) => {
  try {
    let phone = req.user.phone;
    if (!phone) {
      return res.status(401).json({ error: 'No phone in token' });
    }

    phone = normalizePhone(phone);

    const allowed = ['name', 'age', 'bloodGroup', 'medicalInfo', 'reminders', 'gender', 'location', 'language'];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (req.body.reminderSettings && typeof req.body.reminderSettings === 'object') {
      const rs = req.body.reminderSettings;
      const allowedRs = ['morningTime', 'afternoonTime', 'nightTime', 'reminderType', 'alarmTone', 'messageTone'];
      for (const k of allowedRs) {
        if (rs[k] !== undefined) updates[`reminderSettings.${k}`] = rs[k];
      }
    }

    const patient = await Patient.findOneAndUpdate(
      { phone },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    return res.json(patient);
  } catch (err) {
    console.error('patients/me update error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * GET /api/patients/access-requests
 * =========================
 */
router.get('/access-requests', async (req, res) => {
  try {
    let phone = normalizePhone(req.user.phone);

    const patient = await Patient.findOne({ phone }).populate({
      path: 'accessRequests.doctorId',
      model: Doctor,
      select: 'name clinicName',
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const pending = patient.accessRequests.filter(
      (r) => r.status === 'pending'
    );

    return res.json(pending);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/patients/access-requests/:doctorId/accept
 * =========================
 * Patient ACCEPTS doctor access → ONE SESSION STARTS.
 * status = approved, sessionStartedAt = now, autoCloseAt = now + 8h.
 */
router.post('/access-requests/:doctorId/accept', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const { doctorId } = req.params;

    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const getDocIdStr = (d) => {
      if (!d) return '';
      if (typeof d === 'object') return String(d._id || d.id || '');
      return String(d);
    };

    const reqIndex = patient.accessRequests.findIndex(
      (r) => getDocIdStr(r.doctorId) === String(doctorId) && r.status === 'pending'
    );

    if (reqIndex === -1) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    const now = new Date();
    const autoCloseAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);

    const hasActiveSession = (patient.accessRequests || []).some(
      (r) =>
        getDocIdStr(r.doctorId) === String(doctorId) &&
        (r.status === 'approved' || r.status === 'accepted') &&
        r.autoCloseAt &&
        new Date(r.autoCloseAt) > now
    );
    if (hasActiveSession) {
      return res.status(400).json({
        error: 'A consultation session is already active for this doctor',
      });
    }

    patient.accessRequests[reqIndex].status = 'approved';
    patient.accessRequests[reqIndex].respondedAt = now;
    patient.accessRequests[reqIndex].sessionStartedAt = now;
    patient.accessRequests[reqIndex].sessionEndedAt = undefined;
    patient.accessRequests[reqIndex].autoCloseAt = autoCloseAt;

    const targetArId = patient.accessRequests[reqIndex]._id || patient.accessRequests[reqIndex].id;
    if (targetArId) {
      await supabase
        .from('access_requests')
        .update({
          status: 'approved',
          responded_at: now.toISOString(),
          session_started_at: now.toISOString(),
          auto_close_at: autoCloseAt.toISOString(),
        })
        .eq('id', targetArId);
    }

    patient.activeSession = {
      doctorId,
      status: 'active',
      startedAt: now,
    };

    const doctor = await Doctor.findById(doctorId).select('name clinicName').lean();
    patient.notifications = patient.notifications || [];
    patient.notifications.push({
      type: 'session',
      title: 'Doctor access approved',
      message: `Session started${doctor?.name ? ` with Dr. ${doctor.name}` : ''}.`,
      meta: {
        doctorId,
        doctorName: doctor?.name || '',
        clinicName: doctor?.clinicName || '',
        sessionStartedAt: now,
      },
      createdAt: now,
    });

    await patient.save();

    return res.json({
      message: 'Doctor access approved. Session started.',
      status: 'approved',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/patients/access-requests/:doctorId/reject
 * =========================
 */
router.post('/access-requests/:doctorId/reject', async (req, res) => {
  try {
    let phone = normalizePhone(req.user.phone);
    const { doctorId } = req.params;

    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const getDocIdStr = (d) => {
      if (!d) return '';
      if (typeof d === 'object') return String(d._id || d.id || '');
      return String(d);
    };

    const reqIndex = patient.accessRequests.findIndex(
      (r) => getDocIdStr(r.doctorId) === String(doctorId)
    );

    if (reqIndex === -1) {
      return res.status(404).json({ error: 'Access request not found' });
    }

    const now = new Date();
    patient.accessRequests[reqIndex].status = 'rejected';
    patient.accessRequests[reqIndex].respondedAt = now;

    const targetArId = patient.accessRequests[reqIndex]._id || patient.accessRequests[reqIndex].id;
    if (targetArId) {
      await supabase
        .from('access_requests')
        .update({
          status: 'rejected',
          responded_at: now.toISOString(),
        })
        .eq('id', targetArId);
    }

    await patient.save();

    return res.json({
      message: 'Access request rejected.',
      status: 'rejected',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/patients/consult-again
 * =========================
 * Patient requests "consult again" with a doctor who previously prescribed.
 * Body: { doctorId: ObjectId, requestedDate: ISO string }
 */
router.post('/consult-again', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const { doctorId, requestedDate } = req.body;

    if (!doctorId) {
      return res.status(400).json({ error: 'doctorId required' });
    }

    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const doc = await Doctor.findById(doctorId);
    if (!doc) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const hasPrescriptionFromDoctor = (patient.prescriptions || []).some(
      (pr) => pr.doctorId && pr.doctorId.toString() === doctorId
    );
    if (!hasPrescriptionFromDoctor) {
      return res.status(400).json({ error: 'You can only request consult again from a doctor who has prescribed for you' });
    }

    const existingConsult = (patient.consultRequests || []).find(
      (r) => r.doctorId.toString() === doctorId && r.status === 'pending'
    );
    if (existingConsult) {
      return res.status(400).json({ error: 'You already have a pending consult request for this doctor' });
    }

    const reqDate = requestedDate ? new Date(requestedDate) : new Date();
    if (Number.isNaN(reqDate.getTime())) {
      return res.status(400).json({ error: 'Invalid requestedDate' });
    }

    patient.consultRequests = patient.consultRequests || [];
    patient.consultRequests.push({
      doctorId,
      requestedDate: reqDate,
      status: 'pending',
      createdAt: new Date(),
    });
    await patient.save();

    doc.notifications = doc.notifications || [];
    doc.notifications.push({
      patientId: patient._id,
      patientName: patient.name,
      requestedDate: reqDate,
      status: 'pending',
      read: false,
      createdAt: new Date(),
    });
    await doc.save();

    // Patient-side notification
    patient.notifications = patient.notifications || [];
    patient.notifications.push({
      type: 'consult',
      title: 'Consultation request sent',
      message: `Request sent to Dr. ${doc.name} on ${reqDate.toLocaleDateString()}`,
      meta: { doctorId: doc._id, doctorName: doc.name, status: 'pending' },
    });
    await patient.save();

    return res.status(201).json({
      message: 'Consultation request sent to doctor',
      consultRequest: patient.consultRequests[patient.consultRequests.length - 1],
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/patients/notifications
 * =========================
 * Add a patient notification (used by client for reminders).
 * Body: { type, title, message, meta }
 */
router.post('/notifications', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const { type, title, message, meta } = req.body;
    if (!type || !title || !message) {
      return res.status(400).json({ error: 'type, title, message required' });
    }
    patient.notifications = patient.notifications || [];
    patient.notifications.push({ type, title, message, meta });
    await patient.save();
    return res.status(201).json(patient.notifications[patient.notifications.length - 1]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * GET /api/patients/notifications
 * =========================
 */
router.get('/notifications', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const list = (patient.notifications || []).slice().sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/patients/notifications/:id/read
 * =========================
 */
router.post('/notifications/:id/read', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const patient = await Patient.findOne({ phone });
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    const id = req.params.id;
    const notif = (patient.notifications || []).find(
      (n) => n._id && n._id.toString() === id
    );
    if (!notif) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    notif.read = true;
    await patient.save();
    return res.json(notif);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/patients/pharmacy-availability-multi
 * =========================
 * Body: { prescriptionId, selectedMedicines: [{ medicineName, days }] }
 */
router.post('/pharmacy-availability-multi', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const { prescriptionId, selectedMedicines } = req.body;
    const requestedItems = Array.isArray(selectedMedicines) ? selectedMedicines : [];
    if (!prescriptionId || requestedItems.length === 0) {
      return res.status(400).json({ error: 'prescriptionId and selectedMedicines are required' });
    }

    const patient = await Patient.findOne({ phone });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const prescription = (patient.prescriptions || []).find(
      (p) => p._id && p._id.toString() === String(prescriptionId)
    );
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (isPrescriptionExpired(prescription)) {
      return res.status(400).json({ error: 'Prescription is expired' });
    }

    const deliveredRequests = await MedicineRequest.find({
      patientId: patient._id,
      prescriptionId: prescription._id,
      status: { $in: getDeliveredStatuses() },
    }).lean();

    const purchasedByMedicine = new Map();
    for (const req of deliveredRequests) {
      if (Array.isArray(req.requestedMedicines) && req.requestedMedicines.length > 0) {
        for (const item of req.requestedMedicines) {
          const key = normalizeMedicineName(item.medicineName);
          purchasedByMedicine.set(key, (purchasedByMedicine.get(key) || 0) + getPurchasedDaysFromRequestItem(item));
        }
      } else {
        const key = normalizeMedicineName(req.medicineName);
        purchasedByMedicine.set(key, (purchasedByMedicine.get(key) || 0) + getPurchasedDaysFromRequestItem(req));
      }
    }

    const selectedFromPrescription = requestedItems.map((raw) => {
      const rawName = typeof raw === 'string' ? raw : raw?.medicineName || raw?.name;
      const requestedDays = Number(typeof raw === 'object' ? raw?.days : 0);
      const normalizedName = normalizeMedicineName(rawName);
      const medicine = (prescription.medicines || []).find(
        (m) => normalizeMedicineName(m.name) === normalizedName
      );
      if (!medicine) return { error: 'One or more medicines are not present in doctor prescription' };

      const prescribedDays = getMedicinePrescribedDays(medicine, prescription);
      const purchasedDays = purchasedByMedicine.get(normalizedName) || 0;
      const remainingDays = Math.max(0, prescribedDays - purchasedDays);
      if (!Number.isFinite(requestedDays) || requestedDays <= 0) {
        return { error: `Invalid requested days for ${medicine.name}` };
      }
      if (requestedDays > remainingDays) {
        return { error: `Requested days exceed remaining balance for ${medicine.name} (${remainingDays})` };
      }
      const dosesPerDay = calculateDailyDoseCount(medicine);
      return {
        medicineName: medicine.name,
        normalizedMedicineName: normalizedName,
        requestedDays,
        prescribedDays,
        purchasedDays,
        remainingDays: Math.max(0, remainingDays - requestedDays),
        dosesPerDay,
        quantity: dosesPerDay * requestedDays,
      };
    });

    if (selectedFromPrescription.some((m) => m.error)) {
      return res.status(400).json({ error: selectedFromPrescription.find((m) => m.error)?.error || 'Invalid request' });
    }

    const normalizedSet = [...new Set(selectedFromPrescription.map((m) => m.normalizedMedicineName))];
    const pharmacies = await Pharmacy.find({
      stock: { $elemMatch: { normalizedName: { $in: normalizedSet } } },
    }).lean();

    const list = pharmacies.map((p) => {
      const items = selectedFromPrescription.map((m) => {
        const stock = (p.stock || []).find((s) => s.normalizedName === m.normalizedMedicineName);
        const availableQuantity = stock?.quantity || 0;
        return {
          medicineName: m.medicineName,
          requestedDays: m.requestedDays,
          prescribedDays: m.prescribedDays,
          purchasedDays: m.purchasedDays,
          remainingDays: m.remainingDays,
          quantityRequired: m.quantity,
          availableQuantity,
          available: availableQuantity >= m.quantity,
        };
      });
      return {
        pharmacyId: p._id,
        pharmacyName: p.pharmacyName,
        location: p.location,
        available: items.every((x) => x.available),
        items,
      };
    });

    list.sort((a, b) => Number(b.available) - Number(a.available));
    return res.json({
      prescriptionId,
      selectedMedicines: selectedFromPrescription,
      pharmacies: list,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * GET /api/patients/pharmacy-availability
 * =========================
 * Query: prescriptionId, medicineName, days
 */
router.get('/pharmacy-availability', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const { prescriptionId, medicineName } = req.query;
    const days = Number(req.query.days);

    if (!prescriptionId || !medicineName || !Number.isFinite(days) || days <= 0) {
      return res.status(400).json({ error: 'prescriptionId, medicineName, days required' });
    }

    const patient = await Patient.findOne({ phone });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const prescription = (patient.prescriptions || []).find(
      (p) => p._id && p._id.toString() === String(prescriptionId)
    );
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (isPrescriptionExpired(prescription)) {
      return res.status(400).json({ error: 'Prescription is expired' });
    }

    const medicine = (prescription.medicines || []).find(
      (m) => normalizeMedicineName(m.name) === normalizeMedicineName(medicineName)
    );
    if (!medicine) {
      return res.status(400).json({ error: 'Medicine is not present in doctor prescription' });
    }

    const deliveredRequests = await MedicineRequest.find({
      patientId: patient._id,
      prescriptionId: prescription._id,
      status: { $in: getDeliveredStatuses() },
    }).lean();

    let purchasedDays = 0;
    for (const req of deliveredRequests) {
      if (Array.isArray(req.requestedMedicines) && req.requestedMedicines.length > 0) {
        for (const item of req.requestedMedicines) {
          if (normalizeMedicineName(item.medicineName) === normalizeMedicineName(medicine.name)) {
            purchasedDays += getPurchasedDaysFromRequestItem(item);
          }
        }
      } else if (normalizeMedicineName(req.medicineName) === normalizeMedicineName(medicine.name)) {
        purchasedDays += getPurchasedDaysFromRequestItem(req);
      }
    }

    const prescribedDays = getMedicinePrescribedDays(medicine, prescription);
    const remainingDays = Math.max(0, prescribedDays - purchasedDays);
    if (days > remainingDays) {
      return res.status(400).json({ error: `Requested days exceed remaining balance (${remainingDays})` });
    }

    const dosesPerDay = calculateDailyDoseCount(medicine);
    const quantity = dosesPerDay * days;
    const normalized = normalizeMedicineName(medicineName);

    const pharmacies = await Pharmacy.find({
      stock: { $elemMatch: { normalizedName: normalized } },
    }).lean();

    const list = pharmacies.map((p) => {
      const stock = (p.stock || []).find((s) => s.normalizedName === normalized);
      const availableQuantity = stock?.quantity || 0;
      return {
        pharmacyId: p._id,
        pharmacyName: p.pharmacyName,
        location: p.location,
        medicineName: stock?.medicineName || medicine.name,
        quantityRequired: quantity,
        availableQuantity,
        price: stock?.price || 0,
        available: availableQuantity >= quantity,
      };
    });

    list.sort((a, b) => Number(b.available) - Number(a.available));
    return res.json({
      prescriptionId,
      medicineName: medicine.name,
      days,
      prescribedDays,
      purchasedDays,
      remainingDays: Math.max(0, remainingDays - days),
      dosesPerDay,
      quantity,
      pharmacies: list,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/patients/medicine-requests
 * =========================
 * Body: { patientId, prescriptionId, selectedMedicines: [{ medicineName, days }], quantity, pharmacyId }
 */
router.post('/medicine-requests', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const {
      patientId,
      prescriptionId,
      selectedMedicines,
      quantity,
      pharmacyId,
    } = req.body;
    const quantityNum = Number(quantity);
    const inputItems = Array.isArray(selectedMedicines) ? selectedMedicines : [];
    if (!prescriptionId || inputItems.length === 0 || !pharmacyId) {
      return res.status(400).json({ error: 'prescriptionId, selectedMedicines, pharmacyId required' });
    }

    const patient = await Patient.findOne({ phone });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (patientId && String(patientId) !== String(patient._id)) {
      return res.status(400).json({ error: 'patientId does not match authenticated patient' });
    }

    const prescription = (patient.prescriptions || []).find(
      (p) => p._id && p._id.toString() === String(prescriptionId)
    );
    if (!prescription) return res.status(404).json({ error: 'Prescription not found' });
    if (isPrescriptionExpired(prescription)) {
      return res.status(400).json({ error: 'Prescription is expired' });
    }

    const pharmacy = await Pharmacy.findById(pharmacyId);
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    const deliveredRequests = await MedicineRequest.find({
      patientId: patient._id,
      prescriptionId: prescription._id,
      status: { $in: getDeliveredStatuses() },
    }).lean();

    const purchasedByMedicine = new Map();
    for (const req of deliveredRequests) {
      if (Array.isArray(req.requestedMedicines) && req.requestedMedicines.length > 0) {
        for (const item of req.requestedMedicines) {
          const key = normalizeMedicineName(item.medicineName);
          purchasedByMedicine.set(key, (purchasedByMedicine.get(key) || 0) + getPurchasedDaysFromRequestItem(item));
        }
      } else {
        const key = normalizeMedicineName(req.medicineName);
        purchasedByMedicine.set(key, (purchasedByMedicine.get(key) || 0) + getPurchasedDaysFromRequestItem(req));
      }
    }

    const calculatedItems = inputItems.map((rawItem) => {
      const rawName = rawItem?.medicineName || rawItem?.name;
      const normalizedName = normalizeMedicineName(rawName);
      const requestedDays = Number(rawItem?.days);
      const medicine = (prescription.medicines || []).find(
        (m) => normalizeMedicineName(m.name) === normalizedName
      );
      if (!medicine) return { error: 'Medicine is not present in doctor prescription' };
      if (!Number.isFinite(requestedDays) || requestedDays <= 0) {
        return { error: `Invalid requested days for ${medicine.name}` };
      }

      const prescribedDays = getMedicinePrescribedDays(medicine, prescription);
      const purchasedDays = purchasedByMedicine.get(normalizedName) || 0;
      const remainingBefore = Math.max(0, prescribedDays - purchasedDays);
      if (requestedDays > remainingBefore) {
        return { error: `Requested days exceed remaining balance for ${medicine.name} (${remainingBefore})` };
      }

      const dosesPerDay = calculateDailyDoseCount(medicine);
      const calculatedQuantity = dosesPerDay * requestedDays;
      const stock = (pharmacy.stock || []).find((s) => s.normalizedName === normalizedName);
      if (!stock || stock.quantity < calculatedQuantity) {
        return { error: `Selected pharmacy does not have enough stock for ${medicine.name}` };
      }

      return {
        medicineName: medicine.name,
        normalizedMedicineName: normalizedName,
        requestedDays,
        prescribedDays,
        purchasedDays,
        remainingDays: Math.max(0, remainingBefore - requestedDays),
        dosesPerDay,
        quantity: calculatedQuantity,
      };
    });

    if (calculatedItems.some((i) => i.error)) {
      return res.status(400).json({ error: calculatedItems.find((i) => i.error)?.error || 'Invalid request' });
    }

    const totalRequestedDays = calculatedItems.reduce((sum, item) => sum + item.requestedDays, 0);
    const maxPrescribedDays = calculatedItems.reduce((max, item) => Math.max(max, item.prescribedDays), 0);
    const totalQuantity = calculatedItems.reduce((sum, item) => sum + item.quantity, 0);
    if (quantity !== undefined && (!Number.isFinite(quantityNum) || quantityNum <= 0)) {
      return res.status(400).json({ error: 'quantity must be a positive number when provided' });
    }
    if (Number.isFinite(quantityNum) && quantityNum > 0 && quantityNum !== totalQuantity) {
      return res.status(400).json({ error: 'quantity does not match total calculated quantity' });
    }

    const refillReminderAt = new Date();
    refillReminderAt.setDate(refillReminderAt.getDate() + Math.max(1, totalRequestedDays - 1));
    const primary = calculatedItems[0];
    const requestedNames = calculatedItems.map((m) => m.medicineName).join(', ');

    const request = await MedicineRequest.create({
      patientId: patient._id,
      pharmacyId: pharmacy._id,
      prescriptionId: prescription._id,
      doctorId: prescription.doctorId,
      requestedMedicines: calculatedItems,
      requestedDays: totalRequestedDays,
      prescribedDays: maxPrescribedDays,
      isPartialRequest: calculatedItems.some((item) => item.requestedDays < item.prescribedDays),
      prescriptionSnapshot: {
        disease: prescription.disease || '',
        duration: `${maxPrescribedDays} days`,
        doctorName: prescription.doctorName || '',
        clinicName: prescription.clinicName || '',
        medicines: (prescription.medicines || []).map((m) => ({
          name: m.name,
          dosage: m.dosage || '',
          durationInDays: getMedicinePrescribedDays(m, prescription),
          morning: Boolean(m.morning),
          afternoon: Boolean(m.afternoon),
          evening: Boolean(m.evening),
          night: Boolean(m.night),
        })),
      },
      medicineName: primary.medicineName,
      normalizedMedicineName: primary.normalizedMedicineName,
      days: primary.requestedDays,
      dosesPerDay: primary.dosesPerDay,
      quantity: totalQuantity,
      pricePerUnit: 0,
      totalAmount: 0,
      status: 'pending',
      paymentMode: 'cash',
      refillReminderAt,
      refillReminderSent: false,
      requestedAt: new Date(),
    });

    patient.notifications = patient.notifications || [];
    patient.notifications.push({
      type: 'reminder',
      title: 'Medicine request sent',
      message: `${requestedNames} requested from ${pharmacy.pharmacyName}.`,
      meta: {
        targetView: 'medicine-requirement-status',
        requestId: request._id,
        pharmacyId: pharmacy._id,
        selectedMedicines: calculatedItems.map((m) => m.medicineName),
        requestedMedicines: calculatedItems.map((m) => ({
          medicineName: m.medicineName,
          requestedDays: m.requestedDays,
        })),
      },
      createdAt: new Date(),
    });
    await patient.save();

    return res.status(201).json(request);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/medicine-requests', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const patient = await Patient.findOne({ phone });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const list = await MedicineRequest.find({ patientId: patient._id })
      .populate({ path: 'pharmacyId', select: 'pharmacyName location' })
      .sort({ requestedAt: -1 })
      .lean();

    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/medicine-requests/:id/reorder', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const patient = await Patient.findOne({ phone });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const oldRequest = await MedicineRequest.findOne({
      _id: req.params.id,
      patientId: patient._id,
    });
    if (!oldRequest) return res.status(404).json({ error: 'Request not found' });

    const pharmacy = await Pharmacy.findById(oldRequest.pharmacyId);
    if (!pharmacy) return res.status(404).json({ error: 'Pharmacy not found' });

    const stock = (pharmacy.stock || []).find(
      (s) => s.normalizedName === oldRequest.normalizedMedicineName
    );
    if (!stock || stock.quantity < oldRequest.quantity) {
      return res.status(400).json({ error: 'Pharmacy stock unavailable for reorder' });
    }

    const refillReminderAt = new Date();
    refillReminderAt.setDate(refillReminderAt.getDate() + Math.max(1, oldRequest.days - 1));

    const reorder = await MedicineRequest.create({
      patientId: patient._id,
      pharmacyId: oldRequest.pharmacyId,
      prescriptionId: oldRequest.prescriptionId,
      doctorId: oldRequest.doctorId,
      medicineName: oldRequest.medicineName,
      normalizedMedicineName: oldRequest.normalizedMedicineName,
      days: oldRequest.days,
      dosesPerDay: oldRequest.dosesPerDay,
      quantity: oldRequest.quantity,
      pricePerUnit: stock.price,
      totalAmount: oldRequest.quantity * stock.price,
      status: 'pending',
      paymentMode: 'cash',
      reorderOf: oldRequest._id,
      refillReminderAt,
      refillReminderSent: false,
      requestedAt: new Date(),
    });

    patient.notifications = patient.notifications || [];
    patient.notifications.push({
      type: 'reminder',
      title: 'Reorder placed',
      message: `${oldRequest.medicineName} reorder sent to ${pharmacy.pharmacyName}.`,
      meta: {
        targetView: 'prescriptions',
        requestId: reorder._id,
        pharmacyId: pharmacy._id,
        medicineName: oldRequest.medicineName,
      },
      createdAt: new Date(),
    });
    await patient.save();

    return res.status(201).json(reorder);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * GET /api/patients/consult-requests
 * =========================
 * List consult-again requests (for bell: accepted, pending, rescheduled)
 */
router.get('/consult-requests', async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const patient = await Patient.findOne({ phone }).populate({
      path: 'consultRequests.doctorId',
      model: Doctor,
      select: 'name clinicName',
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const list = (patient.consultRequests || []).slice().reverse();
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
