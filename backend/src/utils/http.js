export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function sendError(error, req, res, _next) {
  const status = Number(error.status) || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: {
      message: status >= 500 ? 'An unexpected server error occurred.' : error.message,
      ...(error.errors ? { details: error.errors } : {})
    }
  });
}
