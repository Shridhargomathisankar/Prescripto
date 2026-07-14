import mongoose from 'mongoose';

/**
 * =========================
 * Prescription Schema
 * =========================
 */
const prescriptionSchema = new mongoose.Schema({
  disease: { type: String, required: true },

  medicines: [
    {
      name: { type: String, required: true },
      dosage: { type: String, default: '' },
      morning: { type: Boolean, default: false },
      afternoon: { type: Boolean, default: false },
      evening: { type: Boolean, default: false },
      night: { type: Boolean, default: false },
      durationInDays: { type: Number, required: false, min: 1, default: 7 },
    },
  ],
  createdAt: { type: Date, default: Date.now },

  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },

  // Optional display fields
  doctorName: { type: String },
  clinicName: { type: String },
});

/**
 * =========================
 * Report Schema
 * =========================
 */
const reportSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String },
  dataUrl: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

/**
 * =========================
 * Doctor Access Request Schema (SESSION-BASED)
 * =========================
 * Each approval = ONE VISIT / ONE SESSION only.
 * status = approved → ONLY while session is active (currentTime < autoCloseAt).
 * status = closed → session ended (manual or auto); MUST NOT grant access again.
 */
const accessRequestSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'closed', 'rejected'],
    default: 'pending',
  },

  requestedAt: {
    type: Date,
    default: Date.now,
  },

  respondedAt: {
    type: Date,
  },

  sessionStartedAt: {
    type: Date,
  },

  sessionEndedAt: {
    type: Date,
  },

  autoCloseAt: {
    type: Date,
  },
});

/**
 * =========================
 * Active Visit / Session Schema (NEW)
 * =========================
 * One visit = one doctor + one patient
 */
const activeSessionSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
  },

  status: {
    type: String,
    enum: ['active', 'closed_by_doctor', 'auto_closed'],
  },

  startedAt: {
    type: Date,
  },

  closedAt: {
    type: Date,
  },
});

/**
 * =========================
 * Patient Schema
 * =========================
 */
const patientSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    bloodGroup: { type: String },
    medicalInfo: { type: String },
    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    language: { type: String, default: 'en' },

    /** Reminder preferences: times (HH:mm), type (notification|alarm), tones */
    reminderSettings: {
      morningTime: { type: String, default: '10:00' },
      afternoonTime: { type: String, default: '13:00' },
      nightTime: { type: String, default: '20:00' },
      reminderType: { type: String, enum: ['notification', 'alarm'], default: 'notification' },
      alarmTone: { type: String, default: 'default' },
      messageTone: { type: String, default: 'default' },
    },

    /** Consult-again requests sent by this patient to doctors */
    consultRequests: [
      {
        doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
        requestedDate: { type: Date, required: true },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rescheduled'],
          default: 'pending',
        },
        rescheduledDate: { type: Date },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    prescriptions: [prescriptionSchema],
    reports: [reportSchema],
    reminders: [{ type: String }],

    /** Patient notifications (doctor accept/reschedule, reminders, sessions) */
    notifications: [
      {
        type: {
          type: String,
          enum: ['consult', 'reminder', 'session', 'ACCESS_REQUEST'],
          required: true,
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        meta: { type: mongoose.Schema.Types.Mixed },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Existing doctor access flow (UNCHANGED)
    accessRequests: [accessRequestSchema],

    // 🔥 NEW: Active consultation session
    activeSession: {
      type: activeSessionSchema,
      default: null,
    },
  },
  { timestamps: true }
);

// 🔥 MUST be default export
export default mongoose.model('Patient', patientSchema);
