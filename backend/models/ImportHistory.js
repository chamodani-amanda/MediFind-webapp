import mongoose from 'mongoose';

const importHistorySchema = new mongoose.Schema({
  pharmacyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Pharmacy', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fileName: { type: String, trim: true, maxlength: 180 },
  received: { type: Number, required: true, min: 0 },
  imported: { type: Number, required: true, min: 0 },
  inserted: { type: Number, required: true, min: 0 },
  updated: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['completed', 'failed'], required: true },
  rowErrors: [{ row: Number, message: String }]
}, { timestamps: true });

export default mongoose.model('ImportHistory', importHistorySchema);
