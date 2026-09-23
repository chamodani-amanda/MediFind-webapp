import Medicine from '../models/Medicine.js';
import Availability from '../models/Availability.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

function medicineFilter(query) {
  const filter = {};
  if (query.category) filter.category = query.category;
  if (query.manufacturer) filter.manufacturer = new RegExp(query.manufacturer, 'i');
  return filter;
}

export const listMedicines = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1), limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const filter = medicineFilter(req.query);
  const [medicines, total] = await Promise.all([Medicine.find(filter).sort('name').skip((page - 1) * limit).limit(limit), Medicine.countDocuments(filter)]);
  res.json({ success: true, medicines, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

export const searchMedicines = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  const filter = medicineFilter(req.query);
  if (q) filter.$or = ['name', 'genericName', 'category', 'manufacturer'].map(field => ({ [field]: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }));
  const medicines = await Medicine.find(filter).sort('name').limit(50);
  res.json({ success: true, medicines });
});

export const getMedicine = asyncHandler(async (req, res) => {
  const medicine = await Medicine.findById(req.params.id);
  if (!medicine) throw new HttpError(404, 'Medicine not found');
  const availability = await Availability.find({ medicineId: medicine._id }).populate('pharmacyId');
  res.json({ success: true, medicine, availability });
});

export const createMedicine = asyncHandler(async (req, res) => {
  const medicine = await Medicine.create(req.body);
  res.status(201).json({ success: true, medicine });
});
