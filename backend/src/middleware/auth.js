import jwt from 'jsonwebtoken';
import { readData } from '../services/jsonStore.js';
import { HttpError, asyncHandler } from '../utils/http.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Authentication is required.');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Your session is invalid or has expired.');
  }
  if (!/^\d+$/.test(String(payload.sub || ''))) throw new HttpError(401, 'Your session is invalid or has expired.');

  const { users } = await readData();
  const user = users.find((entry) => Number(entry.id) === Number(payload.sub));
  if (!user || !user.is_active) throw new HttpError(401, 'Your account is unavailable.');
  const { password_hash: _passwordHash, ...safeUser } = user;
  req.user = safeUser;
  next();
});

export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to perform this action.'));
    next();
  };
}
