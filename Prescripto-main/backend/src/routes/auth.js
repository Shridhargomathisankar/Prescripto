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
    console.log('[AUTH VERIFY] Incoming Body:', req.body);
    const { idToken, phone: reqPhone } = req.body || {};

    if (!idToken && !reqPhone) {
      console.warn('[AUTH VERIFY] 400 Bad Request: Missing idToken and phone.');
      return res.status(400).json({ error: 'idToken or phone required' });
    }

    const isDemoToken =
      typeof idToken === 'string' &&
      (idToken.startsWith('demo-') || idToken.startsWith('demo_') || idToken === 'demo-token');

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
    console.log(`[AUTH VERIFY] Phone: ${maskedPhone}, Email: ${email || 'N/A'}`);

    // 1. PATIENT CHECK
    if (phone) {
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
      pharmacy = await Pharmacy.findOne({ phone }).catch((err) => {
        console.error('[AUTH VERIFY] Pharmacy lookup error:', err.message);
        return null;
      });
    }
    if (!pharmacy && email) {
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
    console.error('[AUTH VERIFY ERROR]', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

/**
 * =========================
 * POST /api/auth/register-patient
 * =========================
 */
router.post('/register-patient', async (req, res) => {
  try {
    console.log('[REGISTER PATIENT] Incoming Body:', req.body);
    let { idToken, name, age, phone, bloodGroup, medicalInfo } = req.body || {};

    if (!name || age == null || !phone) {
      console.warn('[REGISTER PATIENT] Validation failed: missing name, age, or phone');
      return res.status(400).json({
        error: 'name, age, phone required',
      });
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      console.warn('[REGISTER PATIENT] Validation failed: invalid phone');
      return res.status(400).json({ error: 'Valid 10-digit phone required' });
    }

    const existing = await Patient.findOne({ phone: cleanPhone }).catch((err) => {
      console.error('[REGISTER PATIENT] Patient findOne error:', err.message);
      return null;
    });

    if (existing) {
      console.warn(`[REGISTER PATIENT] Phone ${cleanPhone} already registered`);
      return res.status(400).json({
        error: 'Phone already registered as patient',
      });
    }

    const cleanName = String(name).trim();
    const patientId = await generateUniquePatientId(cleanName);
    console.log(`[REGISTER PATIENT] Generated patientId: ${patientId}`);

    const patient = await Patient.create({
      patientId,
      phone: cleanPhone,
      name: cleanName,
      age: Number(age),
      bloodGroup: bloodGroup ? String(bloodGroup).trim() : undefined,
      medicalInfo: medicalInfo ? String(medicalInfo).trim() : undefined,
      prescriptions: [],
      reports: [],
      reminders: [],
    });

    console.log(`[REGISTER PATIENT SUCCESS] Patient created: ${patient._id || patient.id}`);

    return res.json({
      role: 'patient',
      user: patient,
      isNew: true,
    });
  } catch (err) {
    console.error('[REGISTER PATIENT ERROR]', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

/**
 * =========================
 * POST /api/auth/register-doctor
 * =========================
 */
router.post('/register-doctor', async (req, res) => {
  try {
    console.log('[REGISTER DOCTOR] Incoming Body:', req.body);
    let { idToken, phone, name, clinicName, specialization } = req.body || {};

    if (!phone || !name || !clinicName) {
      console.warn('[REGISTER DOCTOR] Validation failed: missing phone, name, or clinicName');
      return res.status(400).json({
        error: 'phone, name, clinicName required',
      });
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      console.warn('[REGISTER DOCTOR] Validation failed: invalid phone');
      return res.status(400).json({ error: 'Valid 10-digit phone required' });
    }

    let doctor = await Doctor.findOne({ phone: cleanPhone }).catch((err) => {
      console.error('[REGISTER DOCTOR] Doctor findOne error:', err.message);
      return null;
    });

    if (doctor) {
      console.log(`[REGISTER DOCTOR] Phone ${cleanPhone} already registered as doctor`);
      return res.json({
        role: 'doctor',
        user: doctor,
        isNew: false,
      });
    }

    doctor = await Doctor.create({
      phone: cleanPhone,
      name: String(name).trim(),
      clinicName: String(clinicName).trim(),
      specialization: specialization ? String(specialization).trim() : '',
    });

    console.log(`[REGISTER DOCTOR SUCCESS] Doctor created: ${doctor._id || doctor.id}`);

    return res.json({
      role: 'doctor',
      user: doctor,
      isNew: true,
    });
  } catch (err) {
    console.error('[REGISTER DOCTOR ERROR]', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

/**
 * =========================
 * POST /api/auth/register-pharmacy
 * =========================
 */
router.post('/register-pharmacy', async (req, res) => {
  try {
    console.log('[REGISTER PHARMACY] Incoming Body:', req.body);
    let { idToken, phone, name, pharmacyName, location } = req.body || {};

    if (!phone || !name || !pharmacyName) {
      console.warn('[REGISTER PHARMACY] Validation failed: missing phone, name, or pharmacyName');
      return res.status(400).json({
        error: 'phone, name, pharmacyName required',
      });
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      console.warn('[REGISTER PHARMACY] Validation failed: invalid phone');
      return res.status(400).json({ error: 'Valid 10-digit phone required' });
    }

    let pharmacy = await Pharmacy.findOne({ phone: cleanPhone }).catch((err) => {
      console.error('[REGISTER PHARMACY] Pharmacy findOne error:', err.message);
      return null;
    });

    if (pharmacy) {
      console.log(`[REGISTER PHARMACY] Phone ${cleanPhone} already registered as pharmacy`);
      return res.json({
        role: 'pharmacy',
        user: pharmacy,
        isNew: false,
      });
    }

    pharmacy = await Pharmacy.create({
      phone: cleanPhone,
      name: String(name).trim(),
      pharmacyName: String(pharmacyName).trim(),
      location: location ? String(location).trim() : '',
      stock: [],
    });

    console.log(`[REGISTER PHARMACY SUCCESS] Pharmacy created: ${pharmacy._id || pharmacy.id}`);

    return res.json({
      role: 'pharmacy',
      user: pharmacy,
      isNew: true,
    });
  } catch (err) {
    console.error('[REGISTER PHARMACY ERROR]', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

/**
 * =========================
 * POST /api/auth/register-pharmacy-email
 * =========================
 */
router.post('/register-pharmacy-email', async (req, res) => {
  try {
    console.log('[REGISTER PHARMACY EMAIL] Incoming Body:', req.body);
    let { idToken, email, name, pharmacyName, location } = req.body || {};

    if (!email || !name || !pharmacyName) {
      return res.status(400).json({ error: 'email, name, pharmacyName required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    let pharmacy = await Pharmacy.findOne({ email: cleanEmail }).catch((err) => {
      console.error('[REGISTER PHARMACY EMAIL] Pharmacy findOne error:', err.message);
      return null;
    });

    if (pharmacy) {
      return res.json({ role: 'pharmacy', user: pharmacy, isNew: false });
    }

    pharmacy = await Pharmacy.create({
      phone: '',
      email: cleanEmail,
      name: String(name).trim(),
      pharmacyName: String(pharmacyName).trim(),
      location: location ? String(location).trim() : '',
      stock: [],
    });

    console.log(`[REGISTER PHARMACY EMAIL SUCCESS] Pharmacy created: ${pharmacy._id || pharmacy.id}`);

    return res.json({ role: 'pharmacy', user: pharmacy, isNew: true });
  } catch (err) {
    console.error('[REGISTER PHARMACY EMAIL ERROR]', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
});

export default router;
