export function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) {
    return next();
  }
  const provided = req.header('x-api-key');
  if (provided !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  if (status >= 500) {
    console.error(err);
  }
  res.status(status).json({ error: message });
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
