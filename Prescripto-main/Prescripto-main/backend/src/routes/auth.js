import { Router } from 'express';
import { verifyIdToken } from '../config/firebase.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import Pharmacy from '../models/Pharmacy.js';
import { generateUniquePatientId } from '../utils/patientId.js';

const router = Router();

/**
 * 🔥 Helper: normalize phone to DB format (10 digits)
 */
function normalizePhone(phone) {
  if (!phone) return phone;
  return phone.replace(/\D/g, '').slice(-10);
}

/**
 * =========================
 * POST /api/auth/verify
 * =========================
 */
router.post('/verify', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'idToken required' });
    }

    let decoded;
    try {
      decoded = await verifyIdToken(idToken);
    } catch {
      // 🔥 test user fallback
      return res.json({
        role: null,
        phone: '9999999999',
        isNew: true,
        testUser: true,
      });
    }

    let phone = decoded.phone_number || decoded.firebase?.identities?.phone?.[0];
    const email = decoded.email || (decoded.firebase && decoded.firebase.identities && decoded.firebase.identities.email && decoded.firebase.identities.email[0]) || null;

    if (phone) phone = normalizePhone(phone);

    // ✅ PATIENT CHECK
    const patient = await Patient.findOne({ phone });
    if (patient) {
      return res.json({
        role: 'patient',
        user: patient,
        isNew: false,
      });
    }

    // ✅ DOCTOR CHECK
    const doctor = await Doctor.findOne({ phone });
    if (doctor) {
      return res.json({
        role: 'doctor',
        user: doctor,
        isNew: false,
      });
    }

    // ✅ PHARMACY CHECK (by phone or email)
    const pharmacyQuery = {};
    if (phone) pharmacyQuery.phone = phone;
    if (email) pharmacyQuery.$or = pharmacyQuery.$or || [];
    if (email) pharmacyQuery.$or.push({ email });
    let pharmacy = null;
    if (phone && !email) {
      pharmacy = await Pharmacy.findOne({ phone });
    } else if (email && !phone) {
      pharmacy = await Pharmacy.findOne({ email });
    } else if (phone && email) {
      pharmacy = await Pharmacy.findOne({ $or: [{ phone }, { email }] });
    }
    if (pharmacy) {
      return res.json({
        role: 'pharmacy',
        user: pharmacy,
        isNew: false,
      });
    }

    // 🆕 NEW USER
    return res.json({
      role: null,
      phone,
      isNew: true,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/auth/register-patient
 * =========================
 */
router.post('/register-patient', async (req, res) => {
  try {
    let { idToken, name, age, phone, bloodGroup, medicalInfo } = req.body;

    if (!idToken || !name || age == null || !phone) {
      return res.status(400).json({
        error: 'idToken, name, age, phone required',
      });
    }

    try {
      await verifyIdToken(idToken);
    } catch {
      console.warn('Skipping verify for test user');
    }

    phone = normalizePhone(phone);

    const existing = await Patient.findOne({ phone });
    if (existing) {
      return res.status(400).json({
        error: 'Phone already registered as patient',
      });
    }

    const patientId = await generateUniquePatientId(name);

    const patient = await Patient.create({
      patientId,
      phone,
      name: name.trim(),
      age: Number(age),
      bloodGroup: bloodGroup || undefined,
      medicalInfo: medicalInfo || undefined,
      prescriptions: [],
      reports: [],
      reminders: [],
    });

    return res.json({
      role: 'patient',
      user: patient,
      isNew: true,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/auth/register-doctor
 * =========================
 */
router.post('/register-doctor', async (req, res) => {
  try {
    let {
      idToken,
      phone,
      name,
      clinicName,
      specialization,
    } = req.body;

    if (!idToken || !phone || !name || !clinicName) {
      return res.status(400).json({
        error: 'idToken, phone, name, clinicName required',
      });
    }

    try {
      await verifyIdToken(idToken);
    } catch {
      console.warn('Skipping verify for test user');
    }

    phone = normalizePhone(phone);

    let doctor = await Doctor.findOne({ phone });
    if (doctor) {
      return res.json({
        role: 'doctor',
        user: doctor,
        isNew: false,
      });
    }

    doctor = await Doctor.create({
      phone,
      name: name.trim(),
      clinicName: clinicName.trim(),
      specialization: specialization?.trim() || '',
    });

    return res.json({
      role: 'doctor',
      user: doctor,
      isNew: true,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/auth/register-pharmacy
 * =========================
 */
router.post('/register-pharmacy', async (req, res) => {
  try {
    let { idToken, phone, name, pharmacyName, location } = req.body;

    if (!idToken || !phone || !name || !pharmacyName) {
      return res.status(400).json({
        error: 'idToken, phone, name, pharmacyName required',
      });
    }

    try {
      await verifyIdToken(idToken);
    } catch {
      console.warn('Skipping verify for test user');
    }

    phone = normalizePhone(phone);

    let pharmacy = await Pharmacy.findOne({ phone });
    if (pharmacy) {
      return res.json({
        role: 'pharmacy',
        user: pharmacy,
        isNew: false,
      });
    }

    pharmacy = await Pharmacy.create({
      phone,
      name: name.trim(),
      pharmacyName: pharmacyName.trim(),
      location: location?.trim() || '',
      stock: [],
    });

    return res.json({
      role: 'pharmacy',
      user: pharmacy,
      isNew: true,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * =========================
 * POST /api/auth/register-pharmacy-email
 * Body: { idToken, email, name, pharmacyName, location }
 * =========================
 */
router.post('/register-pharmacy-email', async (req, res) => {
  try {
    let { idToken, email, name, pharmacyName, location } = req.body;

    if (!idToken || !email || !name || !pharmacyName) {
      return res.status(400).json({ error: 'idToken, email, name, pharmacyName required' });
    }

    try {
      await verifyIdToken(idToken);
    } catch {
      console.warn('Skipping verify for test user');
    }

    email = String(email).trim().toLowerCase();

    let pharmacy = await Pharmacy.findOne({ email });
    if (pharmacy) {
      return res.json({ role: 'pharmacy', user: pharmacy, isNew: false });
    }

    pharmacy = await Pharmacy.create({
      phone: '',
      email,
      name: name.trim(),
      pharmacyName: pharmacyName.trim(),
      location: location?.trim() || '',
      stock: [],
    });

    return res.json({ role: 'pharmacy', user: pharmacy, isNew: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
