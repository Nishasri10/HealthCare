import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { sendError } from './utils/http.js';
import authRoutes from './routes/auth.js';
import doctorRoutes from './routes/doctors.js';
import appointmentRoutes from './routes/appointments.js';
import recordRoutes from './routes/records.js';
import adminRoutes from './routes/admin.js';
import profileRoutes from './routes/profile.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-with-')) {
  throw new Error('JWT_SECRET is missing or still a placeholder. Copy backend/.env.example to backend/.env, replace JWT_SECRET with a private random value of at least 32 characters, then restart the backend.');
}

const app = express();
export function corsAllowedOrigins(
  environment = process.env.NODE_ENV,
  configuredOrigin = process.env.FRONTEND_ORIGIN
) {
  if (environment === 'production' && !configuredOrigin) {
    throw new Error(
      'FRONTEND_ORIGIN must be set to the deployed frontend origin in production.'
    );
  }

  const origin = configuredOrigin || 'https://health-care-xcqr.vercel.app';

  let parsedOrigin;

  try {
    const parsed = new URL(origin);

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      throw new Error();
    }

    parsedOrigin = parsed.origin;
  } catch {
    throw new Error(
      'FRONTEND_ORIGIN must be an origin only, without a path or trailing slash.'
    );
  }

  if (environment === 'production') {
    return [parsedOrigin];
  }

  return [
    parsedOrigin,
    'http://localhost:5173',
    'https://health-care-xcqr.vercel.app',
  ].filter((value, index, origins) => origins.indexOf(value) === index);
}
const allowedOrigins = corsAllowedOrigins();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '20kb' }));

app.get('/api/health', (_req, res) => res.json({ data: { status: 'ok' } }));
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use((_req, _res, next) => {
  const error = new Error('Route not found.');
  error.status = 404;
  next(error);
});
app.use(sendError);

export default app;
