import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, minlength: 8, select: false },
  phone: { type: String, trim: true, maxlength: 25 },
  role: { type: String, enum: ['customer', 'pharmacyOwner', 'admin'], default: 'customer', index: true },
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', index: true },
  preferredLanguage: { type: String, enum: ['en', 'si', 'ta'], default: 'en' },
  profilePhoto: { type: String, maxlength: 750000, default: '' },
  active: { type: Boolean, default: true, select: false }
}, { timestamps: true, toJSON: { transform(_doc, ret) { delete ret.password; return ret; } } });

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});
userSchema.methods.comparePassword = function comparePassword(candidate) { return bcrypt.compare(candidate, this.password); };
export default mongoose.model('User', userSchema);
