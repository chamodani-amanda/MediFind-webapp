import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Pharmacy from '../models/Pharmacy.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

const signToken = user => jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const authResponse = (res, status, user) => res.status(status).json({ success: true, token: signToken(user), user });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = 'customer', preferredLanguage = 'en' } = req.body;
  if (!['customer', 'pharmacyOwner'].includes(role)) throw new HttpError(400, 'Invalid account role');
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new HttpError(400, 'A valid email is required');
  if (!/^[+\d][\d\s()-]{7,24}$/.test(phone || '')) throw new HttpError(400, 'A valid phone number is required');
  if ((password || '').length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new HttpError(400, 'Password must contain at least 8 characters, including a letter and number');
  const user = await User.create({ name, email, password, phone, role, preferredLanguage });
  if (role === 'pharmacyOwner' && req.body.pharmacy) {
    try {
      const pharmacy = await Pharmacy.create({ ...req.body.pharmacy, ownerId: user._id, ownerEmail: user.email });
      user.pharmacyId = pharmacy._id;
      await user.save();
    } catch (error) {
      await User.findByIdAndDelete(user._id);
      throw error;
    }
  }
  authResponse(res, 201, user);
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  const user = await User.findOne({ email: String(email || '').toLowerCase() }).select('+password +active');
  if (!user?.active || !(await user.comparePassword(password || ''))) throw new HttpError(401, 'Invalid email or password');
  if (role && role !== user.role) throw new HttpError(403, `This account is registered as ${user.role}`);
  user.password = undefined;
  authResponse(res, 200, user);
});

export const logout = (_req, res) => res.json({ success: true, message: 'Logged out. Remove the token from the client.' });
