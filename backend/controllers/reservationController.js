import Reservation from '../models/Reservation.js';
import Availability from '../models/Availability.js';
import Pharmacy from '../models/Pharmacy.js';
import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

const populateReservation = query => query
  .populate('medicineId', 'name genericName dosage manufacturer image')
  .populate('pharmacyId', 'pharmacyName address city contactNumber openingHours latitude longitude')
  .populate('userId', 'name email phone');

export const createReservation = asyncHandler(async (req, res) => {
  const { pharmacyId, medicineId, quantity, collectionTime } = req.body;
  const requested = Number(quantity);
  if (!Number.isInteger(requested) || requested < 1) throw new HttpError(400, 'Quantity must be a positive whole number');
  if (new Date(collectionTime) <= new Date()) throw new HttpError(400, 'Collection time must be in the future');
  const stock = await Availability.findOneAndUpdate(
    { pharmacyId, medicineId, quantity: { $gte: requested } },
    { $inc: { quantity: -requested }, $set: { lastUpdated: new Date() } },
    { new: true, runValidators: true }
  );
  if (!stock) throw new HttpError(409, 'The requested quantity is not available');
  try {
    await stock.validate(); await stock.save();
    const reservation = await Reservation.create({ userId: req.user._id, pharmacyId, medicineId, quantity: requested, collectionTime });
    await reservation.populate([{ path: 'medicineId', select: 'name genericName dosage manufacturer image' }, { path: 'pharmacyId', select: 'pharmacyName address city contactNumber openingHours latitude longitude' }, { path: 'userId', select: 'name email phone' }]);
    const pharmacy = await Pharmacy.findById(pharmacyId).select('ownerId pharmacyName');
    if (pharmacy?.ownerId) await Notification.create({ userId: pharmacy.ownerId, type: 'reservation_created', title: 'New reservation request', message: `${req.user.name} requested ${requested} × ${reservation.medicineId?.name || 'medicine'}.`, reservationId: reservation._id, pharmacyId, medicineId });
    res.status(201).json({ success: true, reservation });
  } catch (error) {
    await Availability.updateOne({ _id: stock._id }, { $inc: { quantity: requested } });
    throw error;
  }
});

export const userReservations = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const reservations = await populateReservation(Reservation.find(filter).sort('-createdAt'));
  res.json({ success: true, reservations });
});

export const pharmacyReservations = asyncHandler(async (req, res) => {
  const ownership = [{ ownerId: req.user._id }];
  if (req.user.pharmacyId) ownership.push({ _id: req.user.pharmacyId });
  const owned = await Pharmacy.find({ $or: ownership }).select('_id');
  const pharmacyIds = req.user.role === 'admin' && req.query.pharmacyId ? [req.query.pharmacyId] : owned.map(item => item._id);
  const filter = { pharmacyId: { $in: pharmacyIds } };
  if (req.query.status) filter.status = req.query.status;
  const reservations = await populateReservation(Reservation.find(filter).sort('-createdAt'));
  res.json({ success: true, reservations });
});

export const updateReservationStatus = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) throw new HttpError(404, 'Reservation not found');
  const nextStatus = req.body.status;
  const pharmacy = await Pharmacy.findById(reservation.pharmacyId);
  const isOwner = pharmacy?.ownerId.toString() === req.user._id.toString();
  const isCustomerCancellation = reservation.userId.toString() === req.user._id.toString() && nextStatus === 'cancelled';
  if (!isOwner && req.user.role !== 'admin' && !isCustomerCancellation) throw new HttpError(403, 'You cannot update this reservation');
  const allowed = { pending: ['confirmed', 'rejected', 'cancelled'], confirmed: ['ready', 'rejected', 'cancelled'], ready: ['collected', 'cancelled'] };
  if (!allowed[reservation.status]?.includes(nextStatus)) throw new HttpError(409, `Cannot change ${reservation.status} to ${nextStatus}`);
  if (['cancelled', 'rejected'].includes(nextStatus)) await Availability.updateOne({ pharmacyId: reservation.pharmacyId, medicineId: reservation.medicineId }, { $inc: { quantity: reservation.quantity }, $set: { lastUpdated: new Date() } });
  reservation.status = nextStatus;
  if (nextStatus === 'collected') reservation.collectedAt = new Date();
  await reservation.save();
  await reservation.populate([{ path: 'medicineId', select: 'name genericName dosage manufacturer image' }, { path: 'pharmacyId', select: 'pharmacyName address city contactNumber openingHours latitude longitude' }, { path: 'userId', select: 'name email phone' }]);
  const notificationType = { confirmed: 'reservation_confirmed', ready: 'reservation_ready', rejected: 'reservation_rejected', cancelled: 'reservation_cancelled', collected: 'reservation_collected' }[nextStatus];
  if (notificationType) await Notification.create({ userId: reservation.userId._id || reservation.userId, type: notificationType, title: nextStatus === 'confirmed' ? 'Reservation accepted' : nextStatus === 'ready' ? 'Medicine ready for collection' : nextStatus === 'rejected' ? 'Reservation rejected' : nextStatus === 'cancelled' ? 'Reservation cancelled' : 'Medicine collected', message: `${reservation.medicineId?.name || 'Your medicine'} at ${reservation.pharmacyId?.pharmacyName || 'the pharmacy'} is ${nextStatus}.`, reservationId: reservation._id, pharmacyId: reservation.pharmacyId._id || reservation.pharmacyId, medicineId: reservation.medicineId._id || reservation.medicineId });
  res.json({ success: true, reservation });
});

export const reviewReservation = asyncHandler(async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be a whole number from 1 to 5');
  const existing = await Reservation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!existing) throw new HttpError(404, 'Reservation not found');
  if (existing.status !== 'collected') throw new HttpError(409, 'Only completed reservations can be reviewed');
  if (Number.isInteger(existing.reviewRating)) throw new HttpError(409, 'This reservation has already been reviewed');
  const pharmacyExists = await Pharmacy.exists({ _id: existing.pharmacyId });
  if (!pharmacyExists) throw new HttpError(404, 'Pharmacy not found');

  const reservation = await Reservation.findOneAndUpdate(
    { _id: existing._id, userId: req.user._id, status: 'collected', reviewRating: { $exists: false } },
    { $set: { reviewRating: rating, reviewedAt: new Date() } },
    { new: true, runValidators: true }
  );
  if (!reservation) throw new HttpError(409, 'This reservation has already been reviewed');

  try {
    const pharmacy = await Pharmacy.findByIdAndUpdate(existing.pharmacyId, [
      { $set: {
        rating: { $round: [{ $divide: [{ $add: [{ $multiply: [{ $ifNull: ['$rating', 0] }, { $ifNull: ['$reviews', 0] }] }, rating] }, { $add: [{ $ifNull: ['$reviews', 0] }, 1] }] }, 2] },
        reviews: { $add: [{ $ifNull: ['$reviews', 0] }, 1] }
      } }
    ], { new: true });
    res.json({ success: true, reservation, pharmacy: { _id: pharmacy._id, rating: pharmacy.rating, reviews: pharmacy.reviews } });
  } catch (error) {
    await Reservation.updateOne({ _id: reservation._id, reviewRating: rating }, { $unset: { reviewRating: 1, reviewedAt: 1 } });
    throw error;
  }
});

export const deleteReservation = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findOne({ _id: req.params.id, userId: req.user._id });
  if (!reservation) throw new HttpError(404, 'Reservation not found');
  if (!['pending', 'confirmed'].includes(reservation.status)) throw new HttpError(409, 'This reservation can no longer be cancelled');
  await Availability.updateOne({ pharmacyId: reservation.pharmacyId, medicineId: reservation.medicineId }, { $inc: { quantity: reservation.quantity }, $set: { lastUpdated: new Date() } });
  reservation.status = 'cancelled';
  await reservation.save();
  const pharmacy = await Pharmacy.findById(reservation.pharmacyId).select('ownerId pharmacyName');
  if (pharmacy?.ownerId) await Notification.create({ userId: pharmacy.ownerId, type: 'reservation_cancelled', title: 'Reservation cancelled', message: `${req.user.name} cancelled a reservation.`, reservationId: reservation._id, pharmacyId: reservation.pharmacyId, medicineId: reservation.medicineId });
  res.json({ success: true, message: 'Reservation cancelled', reservation });
});
