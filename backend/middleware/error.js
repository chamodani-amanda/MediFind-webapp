export function notFound(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(error, _req, res, _next) {
  let status = error.status || 500;
  let message = error.message || 'Internal server error';
  if (error.name === 'ValidationError') { status = 400; message = Object.values(error.errors).map(item => item.message).join(', '); }
  if (error.code === 11000) { status = 409; message = `A record with that ${Object.keys(error.keyValue).join(', ')} already exists`; }
  if (error.name === 'CastError') { status = 400; message = 'Invalid resource identifier'; }
  res.status(status).json({ success: false, message, ...(error.details ? { details: error.details } : {}), ...(process.env.NODE_ENV === 'development' ? { stack: error.stack } : {}) });
}
