import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['reservation_created', 'reservation_confirmed', 'reservation_ready', 'reservation_collected', 'reservation_cancelled', 'reservation_rejected', 'low_stock'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation' },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy' },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine' },
  read: { type: Boolean, default: false, index: true }
}, { timestamps: true });

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });
export default mongoose.model('Notification', notificationSchema);
