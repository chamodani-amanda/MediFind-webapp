import mongoose from 'mongoose';

const availabilitySchema = new mongoose.Schema({
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true, index: true },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true, index: true },
  quantity: { type: Number, required: true, min: 0, default: 0 },
  unitPrice: { type: Number, min: 0 },
  currency: { type: String, trim: true, uppercase: true, default: 'LKR', maxlength: 3 },
  notes: { type: String, trim: true, maxlength: 500 },
  availabilityStatus: { type: String, enum: ['in', 'low', 'out'], default: 'out', index: true },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });
availabilitySchema.index({ medicineId: 1, pharmacyId: 1 }, { unique: true });
availabilitySchema.pre('validate', function setStatus() {
  const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 10);
  this.availabilityStatus = this.quantity <= 0 ? 'out' : this.quantity <= threshold ? 'low' : 'in';
  this.lastUpdated = new Date();
});
export default mongoose.model('Availability', availabilitySchema);
