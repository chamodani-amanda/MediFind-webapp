import { HttpError } from '../utils/httpError.js';

export const requireFields = (...fields) => (req, _res, next) => {
  const missing = fields.filter(field => req.body[field] === undefined || req.body[field] === '');
  if (missing.length) return next(new HttpError(400, `Missing required fields: ${missing.join(', ')}`));
  next();
};
