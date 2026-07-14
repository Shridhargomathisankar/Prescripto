import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true, // 10 digit normalized phone
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    clinicName: {
      type: String,
      required: true,
      trim: true,
    },

    specialization: {
      type: String,
      default: '',
      trim: true,
    },

    experience: {
      type: Number,
      default: null,
      min: 0,
    },

    location: {
      type: String,
      default: '',
      trim: true,
    },

    /** Doctor notifications: consult-again requests from patients */
    notifications: [
      {
        patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
        patientName: { type: String, required: true },
        requestedDate: { type: Date, required: true },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rescheduled'],
          default: 'pending',
        },
        rescheduledDate: { type: Date },
        read: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Doctor', doctorSchema);
