import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch'; // 🔴 IMPORTANT for Ollama calls
import { connectDB } from './config/db.js';

import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patient.js';
import doctorRoutes from './routes/doctor.js';
import voiceRoutes from './routes/voice.js';
import pharmacyRoutes from './routes/pharmacy.js';

import Patient from './models/Patient.js';
import MedicineRequest from './models/MedicineRequest.js';

const app = express();
const PORT = process.env.PORT || 5000;

/* =========================
   GLOBAL MIDDLEWARES
========================= */
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// 🔴 VERY IMPORTANT – without this, voice intent body will be empty
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

/* =========================
   ROUTES
========================= */
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/pharmacies', pharmacyRoutes);

app.get('/api/health', (_, res) =>
  res.json({ status: 'ok', time: new Date().toISOString() })
);

/* =========================
   AUTO SESSION CLOSE (8 HOURS)
========================= */
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const REFILL_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

async function autoCloseExpiredSessions() {
  try {
    const now = new Date();

    const patients = await Patient.find({
      'accessRequests.status': 'approved',
      'accessRequests.autoCloseAt': { $lte: now },
    });

    for (const patient of patients) {
      let modified = false;

      for (const r of patient.accessRequests) {
        if (
          r.status === 'approved' &&
          r.autoCloseAt &&
          now >= new Date(r.autoCloseAt)
        ) {
          r.status = 'closed';
          r.sessionEndedAt = new Date(r.autoCloseAt);

          if (
            patient.activeSession &&
            patient.activeSession.doctorId &&
            r.doctorId &&
            patient.activeSession.doctorId.toString() ===
              r.doctorId.toString()
          ) {
            patient.activeSession = null;
          }

          patient.notifications = patient.notifications || [];
          patient.notifications.push({
            type: 'session',
            title: 'Session auto-closed',
            message:
              'Your consultation session has ended automatically after 8 hours.',
            meta: { doctorId: r.doctorId, reason: 'auto' },
            createdAt: new Date(),
          });

          modified = true;
        }
      }

      if (modified) {
        await patient.save();
        console.log(`⏱️ Session auto-closed for patient ${patient.patientId}`);
      }
    }
  } catch (err) {
    console.error('Auto-close session error:', err.message);
  }
}

async function createRefillReminders() {
  try {
    const now = new Date();
    const due = await MedicineRequest.find({
      refillReminderSent: false,
      refillReminderAt: { $lte: now },
    })
      .populate({ path: 'patientId', select: '_id notifications' })
      .populate({ path: 'pharmacyId', select: '_id pharmacyName' });

    for (const req of due) {
      if (!req.patientId) {
        req.refillReminderSent = true;
        await req.save();
        continue;
      }

      const patient = await Patient.findById(req.patientId._id);
      if (!patient) {
        req.refillReminderSent = true;
        await req.save();
        continue;
      }

      const alreadyExists = (patient.notifications || []).some(
        (n) => n?.meta?.action === 'reorder' && String(n?.meta?.requestId || '') === String(req._id)
      );

      if (!alreadyExists) {
        patient.notifications = patient.notifications || [];
        patient.notifications.push({
          type: 'reminder',
          title: 'Refill reminder',
          message: `Your ${req.medicineName} supply is ending soon. Tap to reorder from the same pharmacy.`,
          meta: {
            action: 'reorder',
            requestId: req._id,
            pharmacyId: req.pharmacyId?._id || null,
            pharmacyName: req.pharmacyId?.pharmacyName || '',
            medicineName: req.medicineName,
            days: req.days,
            targetView: 'prescriptions',
          },
          createdAt: new Date(),
        });
        await patient.save();
      }

      req.refillReminderSent = true;
      await req.save();
    }
  } catch (err) {
    console.error('Refill reminder worker error:', err.message);
  }
}

/* =========================
   START SERVER
========================= */
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Prescripto API running on http://localhost:${PORT}`);
    });

    setInterval(autoCloseExpiredSessions, CHECK_INTERVAL_MS);
    console.log('⏱️ Auto session close worker started');
    setInterval(createRefillReminders, REFILL_CHECK_INTERVAL_MS);
    console.log('⏱️ Refill reminder worker started');
  })
  .catch((err) => {
    console.error('❌ DB connection failed:', err);
    process.exit(1);
  });
