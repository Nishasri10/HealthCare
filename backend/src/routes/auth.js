import { Router } from 'express';
import { body } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { currentUser, register, signIn } from '../controllers/authController.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

router.post('/register', authLimiter,
  body('name').trim().isLength({ min: 2, max: 120 }),
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isString().bail().isLength({ min: 10, max: 72 }).bail().custom((value) => Buffer.byteLength(value, 'utf8') <= 72),
  validate,
  register
);

router.post('/login', authLimiter,
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isString().bail().notEmpty().bail().custom((value) => Buffer.byteLength(value, 'utf8') <= 72),
  validate,
  signIn
);

router.get('/me', authenticate, currentUser);

export default router;
