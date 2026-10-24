import { Router } from 'express';
import { body } from 'express-validator';
import { readData, updateData } from '../services/jsonStore.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, asyncHandler } from '../utils/http.js';
import { publicUser } from '../services/authService.js';

const router = Router();
router.use(authenticate);

router.patch('/me', [
  body('name').optional().trim().isLength({ min: 2, max: 120 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('qualification').optional().trim().isLength({ min: 2, max: 255 }),
  body('experienceYears').optional().isInt({ min: 0, max: 80 }),
  body('fee').optional().isFloat({ min: 0, max: 100000 }),
  body('bio').optional().trim().isLength({ min: 10, max: 5000 }),
  validate
], asyncHandler(async (req, res) => {
  const fields = ['name', 'email', 'qualification', 'experienceYears', 'fee', 'bio'];
  if (!fields.some((field) => req.body[field] !== undefined)) throw new HttpError(400, 'Provide at least one profile field to update.');
  if (req.user.role !== 'doctor' && ['qualification', 'experienceYears', 'fee', 'bio'].some((field) => req.body[field] !== undefined)) {
    throw new HttpError(403, 'Only doctors can update professional profile fields.');
  }
  const user = await updateData((state) => {
    const current = state.users.find((entry) => Number(entry.id) === Number(req.user.id));
    if (!current) throw new HttpError(404, 'User not found.');
    const email = req.body.email?.toLowerCase();
    if (email && state.users.some((entry) => entry.email === email && Number(entry.id) !== Number(current.id))) {
      throw new HttpError(409, 'An account with this email already exists.');
    }
    if (req.body.name !== undefined) current.name = req.body.name.trim();
    if (email) current.email = email;
    if (req.user.role === 'doctor') {
      const doctor = state.doctors.find((entry) => Number(entry.user_id) === Number(current.id));
      if (!doctor) throw new HttpError(404, 'Doctor profile not found.');
      if (req.body.qualification !== undefined) doctor.qualification = req.body.qualification.trim();
      if (req.body.experienceYears !== undefined) doctor.experience_years = Number(req.body.experienceYears);
      if (req.body.fee !== undefined) doctor.fee = Number(req.body.fee);
      if (req.body.bio !== undefined) doctor.bio = req.body.bio.trim();
    }
    return publicUser(current);
  });
  res.json({ data: user });
}));

export default router;
