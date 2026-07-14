import mongoose from 'mongoose';

const medicineRequestSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: true,
      index: true,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
    },
    requestedMedicines: [
      {
        medicineName: { type: String, required: true, trim: true },
        normalizedMedicineName: { type: String, required: true, index: true },
        dosesPerDay: { type: Number, required: true, min: 1 },
        requestedDays: { type: Number, required: true, min: 1 },
        prescribedDays: { type: Number, required: true, min: 1 },
        purchasedDays: { type: Number, default: 0, min: 0 },
        remainingDays: { type: Number, default: 0, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    requestedDays: { type: Number, min: 1 },
    prescribedDays: { type: Number, min: 1 },
    isPartialRequest: { type: Boolean, default: false },
    prescriptionSnapshot: {
      disease: { type: String, default: '' },
      duration: { type: String, default: '' },
      doctorName: { type: String, default: '' },
      clinicName: { type: String, default: '' },
      medicines: [
        {
          name: { type: String, required: true },
          dosage: { type: String, default: '' },
          durationInDays: { type: Number, min: 1, default: 1 },
          morning: { type: Boolean, default: false },
          afternoon: { type: Boolean, default: false },
          evening: { type: Boolean, default: false },
          night: { type: Boolean, default: false },
        },
      ],
    },
    medicineName: { type: String, required: true, trim: true },
    normalizedMedicineName: { type: String, required: true, index: true },
    days: { type: Number, required: true, min: 1 },
    dosesPerDay: { type: Number, required: true, min: 1 },
    quantity: { type: Number, required: true, min: 1 },
    pricePerUnit: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'ready', 'picked_up'],
      default: 'pending',
      index: true,
    },
    paymentMode: {
      type: String,
      enum: ['cash', 'upi'],
      default: 'cash',
    },
    reorderOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicineRequest',
      default: null,
    },
    refillReminderAt: { type: Date, default: null, index: true },
    refillReminderSent: { type: Boolean, default: false, index: true },
    requestedAt: { type: Date, default: Date.now },
    readyAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('MedicineRequest', medicineRequestSchema);
