import mongoose from 'mongoose';
import { createPublicId } from '../utils/ids.js';

const reservationSchema = new mongoose.Schema({
  reservationId: { type: String, unique: true, default: () => createPublicId('MF'), index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true, index: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true, index: true },
  quantity: { type: Number, required: true, min: 1 },
  collectionTime: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'ready', 'rejected', 'cancelled', 'collected'], default: 'pending', index: true },
  collectedAt: { type: Date },
  reviewRating: { type: Number, min: 1, max: 5 },
  reviewedAt: { type: Date },
  createdDate: { type: Date, default: Date.now }
}, { timestamps: true });
export default mongoose.model('Reservation', reservationSchema);
