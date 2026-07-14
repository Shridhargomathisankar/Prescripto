import mongoose from 'mongoose';

const pharmacyStockSchema = new mongoose.Schema(
  {
    medicineName: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, index: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const pharmacySchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: false, unique: true, sparse: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    pharmacyName: { type: String, required: true, trim: true },
    location: { type: String, default: '', trim: true },
    stock: [pharmacyStockSchema],
  },
  { timestamps: true }
);

export default mongoose.model('Pharmacy', pharmacySchema);
