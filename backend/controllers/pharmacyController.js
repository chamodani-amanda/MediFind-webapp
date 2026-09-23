import Pharmacy from '../models/Pharmacy.js';
import Availability from '../models/Availability.js';
import Medicine from '../models/Medicine.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import ImportHistory from '../models/ImportHistory.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { csvBoolean, csvNumber, parseCsv, requireCsvColumns } from '../utils/csv.js';

const radians = degrees => degrees * Math.PI / 180;
const escapeRegExp = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function validatePharmacyInput(input) {
  const latitude = Number(input.latitude), longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new HttpError(400, 'Latitude must be between -90 and 90');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new HttpError(400, 'Longitude must be between -180 and 180');
  if (!/^[+\d][\d\s()-]{7,24}$/.test(input.contactNumber || '')) throw new HttpError(400, 'Enter a valid pharmacy contact number');
  return { ...input, latitude, longitude };
}
function distanceKm(lat1, lng1, lat2, lng2) {
  const dLat = radians(lat2 - lat1), dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function attachAvailability(pharmacies, medicineQuery) {
  if (!medicineQuery) return pharmacies;
  const search = new RegExp(escapeRegExp(medicineQuery.trim()), 'i');
  const medicines = await Medicine.find({ $or: [{ name: search }, { genericName: search }, { medicineId: search }, { category: search }, { manufacturer: search }] }).lean();
  if (!medicines.length) return [];
  const records = await Availability.find({ medicineId: { $in: medicines.map(item => item._id) }, pharmacyId: { $in: pharmacies.map(item => item._id) }, quantity: { $gt: 0 } }).lean();
  const medicineById = new Map(medicines.map(item => [item._id.toString(), item]));
  const stockByPharmacy = new Map();
  for (const record of records) {
    const key = record.pharmacyId.toString(), current = stockByPharmacy.get(key);
    if (!current || record.quantity > current.quantity) stockByPharmacy.set(key, record);
  }
  return pharmacies.filter(pharmacy => stockByPharmacy.has(pharmacy._id.toString())).map(pharmacy => {
    const availability = stockByPharmacy.get(pharmacy._id.toString());
    return { ...pharmacy, medicine: medicineById.get(availability.medicineId.toString()), availability };
  });
}

export const listPharmacies = asyncHandler(async (req, res) => {
  const locationQuery = String(req.query.location || req.query.city || '').trim();
  const location = locationQuery ? new RegExp(escapeRegExp(locationQuery), 'i') : null;
  const filter = location ? { $or: [{ city: location }, { address: location }, { pharmacyName: location }] } : {};
  const pharmacies = await Pharmacy.find(filter).lean();
  res.json({ success: true, pharmacies: await attachAvailability(pharmacies, req.query.medicine) });
});

export const nearbyPharmacies = asyncHandler(async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng), radius = Math.min(Math.max(Number(req.query.radius) || 5, .1), 500);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new HttpError(400, 'Valid lat and lng query parameters are required');
  const found = await Pharmacy.find({ location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radius * 1000 } } }).lean();
  const pharmacies = found.map(item => ({ ...item, distance: Number(distanceKm(lat, lng, item.latitude, item.longitude).toFixed(2)) }));
  res.json({ success: true, pharmacies: await attachAvailability(pharmacies, req.query.medicine) });
});

export const ownerPharmacies = asyncHandler(async (req, res) => {
  const ownership = [{ ownerId: req.user._id }];
  if (req.user.pharmacyId) ownership.push({ _id: req.user.pharmacyId });
  ownership.push({ ownerEmail: req.user.email });
  let pharmacies = await Pharmacy.find({ $or: ownership });
  // Repair profiles created by an earlier build that saved the email link but
  // did not persist the user's pharmacyId/ownerId relationship.
  for (const pharmacy of pharmacies) {
    if (pharmacy.ownerId.toString() !== req.user._id.toString() && pharmacy.ownerEmail === req.user.email) {
      pharmacy.ownerId = req.user._id;
      await pharmacy.save();
    }
  }
  if (!req.user.pharmacyId && pharmacies[0]) await User.findByIdAndUpdate(req.user._id, { pharmacyId: pharmacies[0]._id });
  const inventory = await Availability.find({ pharmacyId: { $in: pharmacies.map(item => item._id) } }).populate('medicineId');
  res.json({ success: true, pharmacies: pharmacies.map(item => item.toObject()), inventory });
});

export const getPharmacy = asyncHandler(async (req, res) => {
  const pharmacy = await Pharmacy.findById(req.params.id).populate('ownerId', 'name email phone').lean();
  if (!pharmacy) throw new HttpError(404, 'Pharmacy not found');
  const inventory = await Availability.find({ pharmacyId: pharmacy._id }).populate('medicineId');
  res.json({ success: true, pharmacy, inventory });
});

export const createPharmacy = asyncHandler(async (req, res) => {
  const existing = await Pharmacy.findOne({ ownerId: req.user._id });
  if (existing) {
    await User.findByIdAndUpdate(req.user._id, { pharmacyId: existing._id });
    return res.status(200).json({ success: true, pharmacy: existing, message: 'Existing pharmacy restored' });
  }
  const pharmacy = await Pharmacy.create({ ...validatePharmacyInput(req.body), ownerId: req.user._id, ownerEmail: req.user.email });
  await User.findByIdAndUpdate(req.user._id, { pharmacyId: pharmacy._id });
  res.status(201).json({ success: true, pharmacy });
});

export const updatePharmacy = asyncHandler(async (req, res) => {
  const pharmacy = await Pharmacy.findOne({ _id: req.params.id, ownerId: req.user._id });
  if (!pharmacy && req.user.role !== 'admin') throw new HttpError(404, 'Pharmacy not found or not owned by you');
  const target = pharmacy || await Pharmacy.findById(req.params.id);
  Object.assign(target, validatePharmacyInput({ ...target.toObject(), ...req.body }), { ownerId: target.ownerId });
  await target.save();
  res.json({ success: true, pharmacy: target });
});

export const updateStock = asyncHandler(async (req, res) => {
  const pharmacy = await Pharmacy.findById(req.params.id);
  if (!pharmacy) throw new HttpError(404, 'Pharmacy not found');
  if (req.user.role !== 'admin' && pharmacy.ownerId.toString() !== req.user._id.toString()) throw new HttpError(403, 'You can only update your pharmacy stock');
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) throw new HttpError(400, 'Quantity must be a whole number of zero or greater');
  const availability = await Availability.findOneAndUpdate(
    { pharmacyId: pharmacy._id, medicineId: req.body.medicineId },
    { quantity, lastUpdated: new Date() },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await availability.validate(); await availability.save();
  if (quantity <= Number(process.env.LOW_STOCK_THRESHOLD || 10)) {
    const existingAlert = await Notification.findOne({ userId: req.user._id, pharmacyId: pharmacy._id, medicineId: req.body.medicineId, type: 'low_stock', read: false });
    if (!existingAlert) await Notification.create({ userId: req.user._id, type: 'low_stock', title: quantity ? 'Low stock warning' : 'Medicine out of stock', message: `Stock quantity is now ${quantity}.`, pharmacyId: pharmacy._id, medicineId: req.body.medicineId });
  }
  res.json({ success: true, availability });
});

export const importPharmacyInventory = asyncHandler(async (req, res) => {
  const pharmacy = await Pharmacy.findById(req.params.id);
  if (!pharmacy) throw new HttpError(404, 'Pharmacy not found');
  if (req.user.role !== 'admin' && pharmacy.ownerId.toString() !== req.user._id.toString()) throw new HttpError(403, 'You can only import stock for your pharmacy');

  const rows = parseCsv(req.body);
  requireCsvColumns(rows, ['medicineId', 'name', 'genericName', 'category', 'quantity']);
  const valid = [], errors = [], seen = new Set();
  for (const row of rows) {
    try {
      const item = row.data;
      for (const key of ['medicineId', 'name', 'genericName', 'category']) if (!item[key]) throw new Error(`${key} is required`);
      if (seen.has(item.medicineId)) throw new Error(`Duplicate medicineId ${item.medicineId} in this file`);
      seen.add(item.medicineId);
      const stock = { quantity: csvNumber(item.quantity, 'quantity', { min: 0 }), currency: (item.currency || 'LKR').toUpperCase(), notes: item.notes || '' };
      if (item.unitPrice !== '') stock.unitPrice = csvNumber(item.unitPrice, 'unitPrice', { min: 0 });
      valid.push({ rowNumber: row.rowNumber, medicine: { medicineId: item.medicineId, name: item.name, genericName: item.genericName, category: item.category, dosage: item.dosage, form: item.form, manufacturer: item.manufacturer, description: item.description, requiresPrescription: csvBoolean(item.requiresPrescription, false) }, stock });
    } catch (error) { errors.push({ row: row.rowNumber, message: error.message }); }
  }
  const dryRun = req.query.dryRun === 'true';
  if (errors.length || dryRun) return res.status(errors.length ? 422 : 200).json({ success: errors.length === 0, dryRun, pharmacy: pharmacy.pharmacyName, received: rows.length, valid: valid.length, rejected: errors.length, errors, preview: valid.slice(0, 100).map(item => ({ row: item.rowNumber, ...item.medicine, ...item.stock })) });

  await Medicine.bulkWrite(valid.map(({ medicine }) => ({ updateOne: { filter: { medicineId: medicine.medicineId }, update: { $set: medicine }, upsert: true } })), { ordered: false });
  const medicines = await Medicine.find({ medicineId: { $in: valid.map(item => item.medicine.medicineId) } });
  const medicineMap = new Map(medicines.map(item => [item.medicineId, item._id]));
  const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 10);
  const result = await Availability.bulkWrite(valid.map(({ medicine, stock }) => ({ updateOne: { filter: { pharmacyId: pharmacy._id, medicineId: medicineMap.get(medicine.medicineId) }, update: { $set: { ...stock, availabilityStatus: stock.quantity <= 0 ? 'out' : stock.quantity <= threshold ? 'low' : 'in', lastUpdated: new Date() } }, upsert: true } })), { ordered: false });
  const lowRows = valid.filter(item => item.stock.quantity <= threshold);
  if (lowRows.length) await Notification.create({ userId: req.user._id, type: 'low_stock', title: 'Inventory needs attention', message: `${lowRows.length} medicine${lowRows.length === 1 ? '' : 's'} in this CSV are low or out of stock.`, pharmacyId: pharmacy._id });
  const history = await ImportHistory.create({ pharmacyId: pharmacy._id, userId: req.user._id, fileName: String(req.headers['x-file-name'] || 'inventory.csv').slice(0, 180), received: rows.length, imported: valid.length, inserted: result.upsertedCount, updated: result.modifiedCount + result.matchedCount, status: 'completed', rowErrors: [] });
  res.json({ success: true, pharmacy: pharmacy.pharmacyName, received: rows.length, imported: valid.length, inserted: result.upsertedCount, updated: result.modifiedCount + result.matchedCount, history });
});

export const updatePharmacyMedicine = asyncHandler(async (req, res) => {
  const pharmacy = await Pharmacy.findById(req.params.id);
  if (!pharmacy) throw new HttpError(404, 'Pharmacy not found');
  if (req.user.role !== 'admin' && pharmacy.ownerId.toString() !== req.user._id.toString()) throw new HttpError(403, 'You can only edit medicines in your pharmacy');
  const medicine = await Medicine.findById(req.params.medicineId);
  if (!medicine) throw new HttpError(404, 'Medicine not found');
  const availability = await Availability.findOne({ pharmacyId: pharmacy._id, medicineId: medicine._id });
  if (!availability) throw new HttpError(404, 'Medicine is not stocked by this pharmacy');
  const allowedMedicine = ['name', 'genericName', 'category', 'dosage', 'form', 'manufacturer', 'description', 'requiresPrescription'];
  for (const field of allowedMedicine) if (req.body[field] !== undefined) medicine[field] = req.body[field];
  await medicine.save();
  if (req.body.quantity !== undefined) { const quantity = Number(req.body.quantity); if (!Number.isInteger(quantity) || quantity < 0) throw new HttpError(400, 'Quantity must be a whole number of zero or greater'); availability.quantity = quantity; }
  if (req.body.unitPrice !== undefined) { const price = Number(req.body.unitPrice); if (!Number.isFinite(price) || price < 0) throw new HttpError(400, 'Price must be zero or greater'); availability.unitPrice = price; }
  if (req.body.currency !== undefined) availability.currency = req.body.currency;
  if (req.body.notes !== undefined) availability.notes = req.body.notes;
  await availability.save();
  if (availability.quantity <= Number(process.env.LOW_STOCK_THRESHOLD || 10)) {
    const existingAlert = await Notification.findOne({ userId: req.user._id, pharmacyId: pharmacy._id, medicineId: medicine._id, type: 'low_stock', read: false });
    if (!existingAlert) await Notification.create({ userId: req.user._id, type: 'low_stock', title: availability.quantity ? 'Low stock warning' : 'Medicine out of stock', message: `${medicine.name} has ${availability.quantity} remaining.`, pharmacyId: pharmacy._id, medicineId: medicine._id });
  }
  res.json({ success: true, medicine, availability });
});

export const deletePharmacyMedicine = asyncHandler(async (req, res) => {
  const pharmacy = await Pharmacy.findById(req.params.id);
  if (!pharmacy) throw new HttpError(404, 'Pharmacy not found');
  if (req.user.role !== 'admin' && pharmacy.ownerId.toString() !== req.user._id.toString()) throw new HttpError(403, 'You can only remove medicines from your pharmacy');
  const removed = await Availability.findOneAndDelete({ pharmacyId: pharmacy._id, medicineId: req.params.medicineId });
  if (!removed) throw new HttpError(404, 'Medicine is not stocked by this pharmacy');
  res.json({ success: true, message: 'Medicine removed from this pharmacy inventory' });
});

export const pharmacyImportHistory = asyncHandler(async (req, res) => {
  const pharmacy = await Pharmacy.findById(req.params.id);
  if (!pharmacy) throw new HttpError(404, 'Pharmacy not found');
  if (req.user.role !== 'admin' && pharmacy.ownerId.toString() !== req.user._id.toString()) throw new HttpError(403, 'You can only view your pharmacy import history');
  const history = await ImportHistory.find({ pharmacyId: pharmacy._id }).sort('-createdAt').limit(25).lean();
  res.json({ success: true, history });
});
