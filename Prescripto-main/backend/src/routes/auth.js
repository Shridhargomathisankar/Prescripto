import { Router } from 'express';
import { verifyIdToken } from '../config/firebase.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import Pharmacy from '../models/Pharmacy.js';
import { generateUniquePatientId } from '../utils/patientId.js';

const router = Router();

function normalizePhone(phone) {
  if (!phone) return phone;
  return String(phone).replace(/\D/g, '').slice(-10);
}

/**
 * =========================
 * POST /api/auth/verify
 * Unified Development Auth Verification
 * =========================
 */
router.post('/verify', async (req, res) => {
  try {
    const { idToken, phone: reqPhone } = req.body;
    console.log('[AUTH VERIFY] Verification request received.');

    if (!idToken && !reqPhone) {
      console.warn('[AUTH VERIFY] 400 Bad Request: Missing idToken and phone.');
      return res.status(400).json({ error: 'idToken or phone required' });
    }

    const isDemoToken =
      typeof idToken === 'string' &&
      (idToken.startsWith('demo-') || idToken.startsWith('demo_') || idToken === 'demo-token');
    console.log(`[AUTH VERIFY] Demo token detected: ${isDemoToken}`);

    let decoded = {};
    if (idToken) {
      try {
        decoded = await verifyIdToken(idToken);
      } catch (tokenErr) {
        console.warn(`[AUTH VERIFY] verifyIdToken soft warning: ${tokenErr.message}`);
        decoded = {};
      }
    }

    let phone =
      decoded.phone_number ||
      decoded.firebase?.identities?.phone?.[0] ||
      reqPhone ||
      (typeof idToken === 'string' && idToken.replace(/\D/g, '')) ||
      null;

    const email =
      decoded.email ||
      (decoded.firebase?.identities?.email?.[0]) ||
      null;

    if (phone) phone = normalizePhone(phone);

    const maskedPhone = phone && phone.length >= 10
      ? `${phone.slice(0, 2)}****${phone.slice(-4)}`
      : phone || 'N/A';
    console.log(`[AUTH VERIFY] Phone format: ${maskedPhone}`);

    // 1. PATIENT CHECK
    if (phone) {
      console.log('[AUTH VERIFY] Checking Patients table...');
      const patient = await Patient.findOne({ phone }).catch((err) => {
        console.error('[AUTH VERIFY] Patient lookup error:', err.message);
        return null;
      });
      if (patient) {
        console.log('[AUTH VERIFY] Role matched: PATIENT (200 OK)');
        return res.json({
          role: 'patient',
          user: patient,
          isNew: false,
        });
      }
    }

    // 2. DOCTOR CHECK
    if (phone) {
      console.log('[AUTH VERIFY] Checking Doctors table...');
      const doctor = await Doctor.findOne({ phone }).catch((err) => {
        console.error('[AUTH VERIFY] Doctor lookup error:', err.message);
        return null;
      });
      if (doctor) {
        console.log('[AUTH VERIFY] Role matched: DOCTOR (200 OK)');
        return res.json({
          role: 'doctor',
          user: doctor,
          isNew: false,
        });
      }
    }

    // 3. PHARMACY CHECK (by phone or email)
    let pharmacy = null;
    if (phone) {
      console.log('[AUTH VERIFY] Checking Pharmacies table by phone...');
      pharmacy = await Pharmacy.findOne({ phone }).catch((err) => {
        console.error('[AUTH VERIFY] Pharmacy lookup error:', err.message);
        return null;
      });
    }
    if (!pharmacy && email) {
      console.log('[AUTH VERIFY] Checking Pharmacies table by email...');
      pharmacy = await Pharmacy.findOne({ email }).catch((err) => {
        console.error('[AUTH VERIFY] Pharmacy email lookup error:', err.message);
        return null;
      });
    }
    if (pharmacy) {
      console.log('[AUTH VERIFY] Role matched: PHARMACY (200 OK)');
      return res.json({
        role: 'pharmacy',
        user: pharmacy,
        isNew: false,
      });
    }

    // 4. NEW USER (No role found in DB yet)
    console.log('[AUTH VERIFY] No role matched: NEW USER (200 OK)');
    return res.json({
      role: null,
      phone,
      isNew: true,
    });
  } catch (err) {
    console.error('[AUTH VERIFY] Internal Server Error:', err.message);
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

    if (!name || age == null || !phone) {
      return res.status(400).json({
        error: 'name, age, phone required',
      });
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
    let { idToken, phone, name, clinicName, specialization } = req.body;

    if (!phone || !name || !clinicName) {
      return res.status(400).json({
        error: 'phone, name, clinicName required',
      });
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

    if (!phone || !name || !pharmacyName) {
      return res.status(400).json({
        error: 'phone, name, pharmacyName required',
      });
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
 * =========================
 */
router.post('/register-pharmacy-email', async (req, res) => {
  try {
    let { idToken, email, name, pharmacyName, location } = req.body;

    if (!email || !name || !pharmacyName) {
      return res.status(400).json({ error: 'email, name, pharmacyName required' });
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
