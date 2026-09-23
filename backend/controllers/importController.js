import Pharmacy from '../models/Pharmacy.js';
import Medicine from '../models/Medicine.js';
import Availability from '../models/Availability.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { csvBoolean, csvNumber, parseCsv, requireCsvColumns } from '../utils/csv.js';

function validationResult(type, rows, valid, errors, dryRun) {
  return { success: errors.length === 0, type, dryRun, received: rows.length, valid: valid.length, rejected: errors.length, errors };
}

function collect(rows, mapper) {
  const valid = [], errors = [];
  for (const row of rows) {
    try { valid.push({ rowNumber: row.rowNumber, value: mapper(row.data) }); }
    catch (error) { errors.push({ row: row.rowNumber, message: error.message }); }
  }
  return { valid, errors };
}

export const importMedicines = asyncHandler(async (req, res) => {
  const rows = parseCsv(req.body);
  requireCsvColumns(rows, ['medicineId', 'name', 'genericName', 'category']);
  const { valid, errors } = collect(rows, item => {
    if (!item.medicineId || !item.name || !item.genericName || !item.category) throw new Error('medicineId, name, genericName and category are required');
    return { medicineId: item.medicineId, name: item.name, genericName: item.genericName, category: item.category, description: item.description, manufacturer: item.manufacturer, dosage: item.dosage, image: item.image };
  });
  const dryRun = req.query.dryRun === 'true';
  if (errors.length || dryRun) return res.status(errors.length ? 422 : 200).json(validationResult('medicines', rows, valid, errors, dryRun));
  const result = await Medicine.bulkWrite(valid.map(({ value }) => ({ updateOne: { filter: { medicineId: value.medicineId }, update: { $set: value }, upsert: true } })), { ordered: false });
  res.json({ ...validationResult('medicines', rows, valid, [], false), inserted: result.upsertedCount, updated: result.modifiedCount + result.matchedCount });
});

export const importPharmacies = asyncHandler(async (req, res) => {
  const rows = parseCsv(req.body);
  requireCsvColumns(rows, ['pharmacyId', 'pharmacyName', 'address', 'city', 'latitude', 'longitude', 'contactNumber', 'openingHours']);
  const { valid, errors } = collect(rows, item => {
    for (const key of ['pharmacyId', 'pharmacyName', 'address', 'city', 'contactNumber', 'openingHours']) if (!item[key]) throw new Error(`${key} is required`);
    const latitude = csvNumber(item.latitude, 'latitude', { min: -90, max: 90 });
    const longitude = csvNumber(item.longitude, 'longitude', { min: -180, max: 180 });
    return { pharmacyId: item.pharmacyId, pharmacyName: item.pharmacyName, address: item.address, city: item.city, latitude, longitude, location: { type: 'Point', coordinates: [longitude, latitude] }, contactNumber: item.contactNumber, openingHours: item.openingHours, rating: csvNumber(item.rating, 'rating', { min: 0, max: 5, fallback: 0 }), reviews: csvNumber(item.reviews, 'reviews', { min: 0, fallback: 0 }), verified: csvBoolean(item.verified, false), ownerEmail: item.ownerEmail?.toLowerCase() };
  });
  if (!errors.length) {
    const emails = [...new Set(valid.map(item => item.value.ownerEmail).filter(Boolean))];
    const owners = await User.find({ email: { $in: emails }, role: { $in: ['pharmacyOwner', 'admin'] } });
    const ownerMap = new Map(owners.map(owner => [owner.email, owner._id]));
    for (const item of valid) {
      if (item.value.ownerEmail && !ownerMap.has(item.value.ownerEmail)) errors.push({ row: item.rowNumber, message: `No pharmacy owner or admin found for ${item.value.ownerEmail}` });
      item.value.ownerId = ownerMap.get(item.value.ownerEmail) || req.user._id;
      delete item.value.ownerEmail;
    }
  }
  const dryRun = req.query.dryRun === 'true';
  if (errors.length || dryRun) return res.status(errors.length ? 422 : 200).json(validationResult('pharmacies', rows, valid, errors, dryRun));
  const result = await Pharmacy.bulkWrite(valid.map(({ value }) => ({ updateOne: { filter: { pharmacyId: value.pharmacyId }, update: { $set: value }, upsert: true } })), { ordered: false });
  res.json({ ...validationResult('pharmacies', rows, valid, [], false), inserted: result.upsertedCount, updated: result.modifiedCount + result.matchedCount });
});

export const importInventory = asyncHandler(async (req, res) => {
  const rows = parseCsv(req.body);
  requireCsvColumns(rows, ['pharmacyId', 'medicineId', 'quantity']);
  const parsed = collect(rows, item => {
    if (!item.pharmacyId || !item.medicineId) throw new Error('pharmacyId and medicineId are required');
    return { pharmacyPublicId: item.pharmacyId, medicinePublicId: item.medicineId, quantity: csvNumber(item.quantity, 'quantity', { min: 0 }) };
  });
  const pharmacyIds = [...new Set(parsed.valid.map(item => item.value.pharmacyPublicId))];
  const medicineIds = [...new Set(parsed.valid.map(item => item.value.medicinePublicId))];
  const [pharmacies, medicines] = await Promise.all([Pharmacy.find({ pharmacyId: { $in: pharmacyIds } }), Medicine.find({ medicineId: { $in: medicineIds } })]);
  const pharmacyMap = new Map(pharmacies.map(item => [item.pharmacyId, item._id]));
  const medicineMap = new Map(medicines.map(item => [item.medicineId, item._id]));
  for (const item of parsed.valid) {
    if (!pharmacyMap.has(item.value.pharmacyPublicId)) parsed.errors.push({ row: item.rowNumber, message: `Unknown pharmacyId ${item.value.pharmacyPublicId}` });
    if (!medicineMap.has(item.value.medicinePublicId)) parsed.errors.push({ row: item.rowNumber, message: `Unknown medicineId ${item.value.medicinePublicId}` });
    item.value.pharmacyId = pharmacyMap.get(item.value.pharmacyPublicId);
    item.value.medicineId = medicineMap.get(item.value.medicinePublicId);
  }
  const dryRun = req.query.dryRun === 'true';
  if (parsed.errors.length || dryRun) return res.status(parsed.errors.length ? 422 : 200).json(validationResult('inventory', rows, parsed.valid, parsed.errors, dryRun));
  const threshold = Number(process.env.LOW_STOCK_THRESHOLD || 10);
  const result = await Availability.bulkWrite(parsed.valid.map(({ value }) => ({ updateOne: { filter: { pharmacyId: value.pharmacyId, medicineId: value.medicineId }, update: { $set: { quantity: value.quantity, availabilityStatus: value.quantity <= 0 ? 'out' : value.quantity <= threshold ? 'low' : 'in', lastUpdated: new Date() } }, upsert: true } })), { ordered: false });
  res.json({ ...validationResult('inventory', rows, parsed.valid, [], false), inserted: result.upsertedCount, updated: result.modifiedCount + result.matchedCount });
});

export const importSummary = asyncHandler(async (_req, res) => {
  const [pharmacies, medicines, inventory] = await Promise.all([Pharmacy.countDocuments(), Medicine.countDocuments(), Availability.countDocuments()]);
  res.json({ success: true, counts: { pharmacies, medicines, inventory } });
});
