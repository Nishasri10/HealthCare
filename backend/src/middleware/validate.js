import { validationResult } from 'express-validator';
import { HttpError } from '../utils/http.js';

export function validate(req, _res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) return next(new HttpError(400, 'Please check the submitted information.'));
  next();
}
