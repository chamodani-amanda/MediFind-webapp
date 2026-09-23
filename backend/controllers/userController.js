import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

export const getProfile = asyncHandler(async (req, res) => res.json({ success: true, user: req.user }));
export const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'email', 'phone', 'preferredLanguage', 'profilePhoto'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) throw new HttpError(400, 'Enter a valid email address');
  if (updates.profilePhoto && !/^data:image\/(jpeg|png|webp);base64,/.test(updates.profilePhoto)) throw new HttpError(400, 'Profile photo must be a JPEG, PNG, or WebP image');
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ success: true, user });
});
