import mongoose from 'mongoose';
import { createPublicId } from '../utils/ids.js';

const pharmacySchema = new mongoose.Schema({
  pharmacyId: { type: String, unique: true, default: () => createPublicId('PHA'), index: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerEmail: { type: String, lowercase: true, trim: true, index: true },
  pharmacyName: { type: String, required: true, trim: true, index: true },
  address: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true, index: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true, validate: value => value.length === 2 }
  },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  contactNumber: { type: String, required: true, trim: true },
  openingHours: { type: String, required: true, trim: true },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviews: { type: Number, min: 0, default: 0 },
  verified: { type: Boolean, default: false }
}, { timestamps: true });
pharmacySchema.index({ location: '2dsphere' });
pharmacySchema.pre('validate', function syncCoordinates() {
  if (Number.isFinite(this.latitude) && Number.isFinite(this.longitude)) this.location = { type: 'Point', coordinates: [this.longitude, this.latitude] };
});
export default mongoose.model('Pharmacy', pharmacySchema);
