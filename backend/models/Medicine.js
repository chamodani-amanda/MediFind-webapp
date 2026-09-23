import mongoose from 'mongoose';
import { createPublicId } from '../utils/ids.js';

const medicineSchema = new mongoose.Schema({
  medicineId: { type: String, unique: true, default: () => createPublicId('MED'), index: true },
  name: { type: String, required: true, trim: true, index: true },
  genericName: { type: String, required: true, trim: true, index: true },
  category: { type: String, required: true, trim: true, index: true },
  description: { type: String, trim: true, maxlength: 1500 },
  manufacturer: { type: String, trim: true },
  image: { type: String, trim: true },
  dosage: { type: String, trim: true },
  form: { type: String, trim: true },
  requiresPrescription: { type: Boolean, default: false }
}, { timestamps: true });
medicineSchema.index({ name: 'text', genericName: 'text', manufacturer: 'text' });
export default mongoose.model('Medicine', medicineSchema);
