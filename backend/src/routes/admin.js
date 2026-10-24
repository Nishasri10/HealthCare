import { Router } from 'express';
import { body, param, query as queryParam } from 'express-validator';
import bcrypt from 'bcryptjs';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { readData, nextId, updateData } from '../services/jsonStore.js';
import { HttpError, asyncHandler } from '../utils/http.js';
import { publicUser } from '../services/authService.js';

const router = Router();
router.use(authenticate, authorize('admin'));

function pageOf(items, page, limit) {
  const start = (page - 1) * limit;
  const entries = items.slice(start, start + limit + 1);
  return { data: entries.slice(0, limit), pagination: { page, limit, hasMore: entries.length > limit } };
}

function doctorView(state, doctor) {
  const user = state.users.find((entry) => Number(entry.id) === Number(doctor.user_id));
  const specialisation = state.specialisations.find((entry) => Number(entry.id) === Number(doctor.specialisation_id));
  return { ...doctor, name: user?.name, email: user?.email, is_active: user?.is_active, specialisation: specialisation?.name, consultation_mode: doctor.consultation_mode || 'In-person' };
}

function appointmentView(state, appointment) {
  const slot = state.availability.find((entry) => Number(entry.id) === Number(appointment.slot_id));
  const doctor = state.doctors.find((entry) => Number(entry.id) === Number(appointment.doctor_id));
  const patient = state.users.find((entry) => Number(entry.id) === Number(appointment.patient_id));
  const doctorUser = state.users.find((entry) => Number(entry.id) === Number(doctor?.user_id));
  const specialisation = state.specialisations.find((entry) => Number(entry.id) === Number(doctor?.specialisation_id));
  const { reason: _privateReason, ...safeAppointment } = appointment;
  return { ...safeAppointment, starts_at: slot?.starts_at, ends_at: slot?.ends_at, patient_name: patient?.name, doctor_name: doctorUser?.name, specialisation: specialisation?.name };
}

router.get('/dashboard', asyncHandler(async (_req, res) => {
  const state = await readData();
  const appointments = state.appointments;
  const totals = {
    users: state.users.length,
    patients: state.users.filter((user) => user.role === 'patient' && user.is_active).length,
    doctors: state.doctors.filter((doctor) => state.users.some((user) => Number(user.id) === Number(doctor.user_id) && user.is_active)).length,
    appointments: appointments.length,
    specialisations: state.specialisations.length
  };
  for (const status of ['booked', 'confirmed', 'completed', 'cancelled', 'declined']) totals[status] = appointments.filter((item) => item.status === status).length;
  const months = new Map();
  for (const appointment of appointments) {
    const slot = state.availability.find((entry) => Number(entry.id) === Number(appointment.slot_id));
    const month = slot?.starts_at?.slice(0, 7);
    if (month) months.set(month, (months.get(month) || 0) + 1);
  }
  const doctorsBySpecialisation = state.specialisations.map((specialisation) => ({
    specialisation: specialisation.name,
    doctors: state.doctors.filter((doctor) => Number(doctor.specialisation_id) === Number(specialisation.id)).length
  })).sort((a, b) => b.doctors - a.doctors || a.specialisation.localeCompare(b.specialisation));
  res.json({ data: { totals, monthlyAppointments: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total })), doctorsBySpecialisation } });
}));

router.get('/users', [
  queryParam('page').optional().isInt({ min: 1, max: 100000 }), queryParam('limit').optional().isInt({ min: 1, max: 50 }),
  queryParam('role').optional().isIn(['patient', 'doctor', 'admin']), queryParam('search').optional().trim().isLength({ max: 100 }), validate
], asyncHandler(async (req, res) => {
  const state = await readData();
  const page = Number(req.query.page || 1);
  const limit = Math.min(50, Number(req.query.limit || 25));
  const search = String(req.query.search || '').toLowerCase();
  const users = state.users.filter((user) => (!req.query.role || user.role === req.query.role)
    && (!search || user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(({ password_hash: _passwordHash, ...user }) => user);
  res.json(pageOf(users, page, limit));
}));

router.get('/doctors', [
  queryParam('page').optional().isInt({ min: 1, max: 100000 }), queryParam('limit').optional().isInt({ min: 1, max: 50 }), validate
], asyncHandler(async (req, res) => {
  const state = await readData();
  const rows = state.doctors.map((doctor) => doctorView(state, doctor)).sort((a, b) => a.name.localeCompare(b.name));
  res.json(pageOf(rows, Number(req.query.page || 1), Math.min(50, Number(req.query.limit || 12))));
}));

router.patch('/users/:id/status', param('id').isInt({ min: 1 }), body('isActive').isBoolean(), validate, asyncHandler(async (req, res) => {
  const updated = await updateData((state) => {
    const user = state.users.find((entry) => Number(entry.id) === Number(req.params.id));
    if (!user) throw new HttpError(404, 'User not found.');
    if (Number(user.id) === Number(req.user.id) && !req.body.isActive) throw new HttpError(400, 'You cannot deactivate your own account.');
    if (user.role === 'admin') throw new HttpError(403, 'Administrator account status cannot be changed here.');
    user.is_active = req.body.isActive;
    return { id: user.id, is_active: user.is_active };
  });
  res.json({ data: updated });
}));

router.get('/appointments', [
  queryParam('status').optional().isIn(['booked', 'confirmed', 'completed', 'cancelled', 'declined']),
  queryParam('page').optional().isInt({ min: 1, max: 100000 }), queryParam('limit').optional().isInt({ min: 1, max: 50 }), validate
], asyncHandler(async (req, res) => {
  const state = await readData();
  const rows = state.appointments.filter((item) => !req.query.status || item.status === req.query.status)
    .sort((a, b) => (state.availability.find((slot) => Number(slot.id) === Number(b.slot_id))?.starts_at || '').localeCompare(state.availability.find((slot) => Number(slot.id) === Number(a.slot_id))?.starts_at || ''))
    .map((item) => appointmentView(state, item));
  res.json(pageOf(rows, Number(req.query.page || 1), Math.min(50, Number(req.query.limit || 25))));
}));

router.get('/reports', asyncHandler(async (_req, res) => {
  const state = await readData();
  const counts = new Map();
  const days = new Map();
  for (const appointment of state.appointments) {
    counts.set(appointment.status, (counts.get(appointment.status) || 0) + 1);
    const slot = state.availability.find((entry) => Number(entry.id) === Number(appointment.slot_id));
    const day = slot?.starts_at?.slice(0, 10);
    if (day) days.set(day, (days.get(day) || 0) + 1);
  }
  res.json({ data: { appointmentsByStatus: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([status, total]) => ({ status, total })), dailyAppointments: [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, total]) => ({ day, total })) } });
}));

router.post('/doctors', [
  body('name').trim().isLength({ min: 2, max: 120 }), body('email').trim().isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 12, max: 72 }).bail().custom((value) => Buffer.byteLength(value, 'utf8') <= 72),
  body('specialisationId').isInt({ min: 1 }), body('qualification').trim().isLength({ min: 2, max: 255 }),
  body('experienceYears').isInt({ min: 0, max: 80 }), body('fee').isFloat({ min: 0, max: 100000 }),
  body('consultationMinutes').isInt({ min: 10, max: 240 }), body('consultationMode').optional().isIn(['In-person', 'Online', 'Both']),
  body('bio').trim().isLength({ min: 10, max: 5000 }), validate
], asyncHandler(async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 12);
  const created = await updateData((state) => {
    const email = req.body.email.toLowerCase();
    if (state.users.some((user) => user.email === email)) throw new HttpError(409, 'An account with this email already exists.');
    if (!state.specialisations.some((entry) => Number(entry.id) === Number(req.body.specialisationId))) throw new HttpError(400, 'Choose a valid specialisation.');
    const user = { id: nextId(state.users), name: req.body.name.trim(), email, password_hash: hash, role: 'doctor', is_active: true, created_at: new Date().toISOString() };
    state.users.push(user);
    const doctor = { id: nextId(state.doctors), user_id: user.id, specialisation_id: Number(req.body.specialisationId), qualification: req.body.qualification.trim(), experience_years: Number(req.body.experienceYears), fee: Number(req.body.fee), consultation_minutes: Number(req.body.consultationMinutes), consultation_mode: req.body.consultationMode || 'In-person', bio: req.body.bio.trim() };
    state.doctors.push(doctor);
    return doctorView(state, doctor);
  });
  res.status(201).json({ data: created });
}));

router.patch('/doctors/:id', param('id').isInt({ min: 1 }),
  body('specialisationId').optional().isInt({ min: 1 }), body('qualification').optional().trim().isLength({ min: 2, max: 255 }),
  body('experienceYears').optional().isInt({ min: 0, max: 80 }), body('fee').optional().isFloat({ min: 0, max: 100000 }),
  body('consultationMinutes').optional().isInt({ min: 10, max: 240 }), body('consultationMode').optional().isIn(['In-person', 'Online', 'Both']),
  body('bio').optional().trim().isLength({ min: 10, max: 5000 }), validate,
  asyncHandler(async (req, res) => {
    const result = await updateData((state) => {
      const doctor = state.doctors.find((entry) => Number(entry.id) === Number(req.params.id));
      if (!doctor) throw new HttpError(404, 'Doctor not found.');
      if (req.body.specialisationId !== undefined && !state.specialisations.some((entry) => Number(entry.id) === Number(req.body.specialisationId))) throw new HttpError(400, 'Choose a valid specialisation.');
      if (req.body.consultationMinutes !== undefined && (state.availability.some((slot) => Number(slot.doctor_id) === Number(doctor.id) && new Date(slot.starts_at) > new Date())
        || state.appointments.some((item) => Number(item.doctor_id) === Number(doctor.id) && ['booked', 'confirmed'].includes(item.status)))) {
        throw new HttpError(409, 'Remove future availability and resolve active appointments before changing consultation duration.');
      }
      if (req.body.specialisationId !== undefined) doctor.specialisation_id = Number(req.body.specialisationId);
      if (req.body.qualification !== undefined) doctor.qualification = req.body.qualification.trim();
      if (req.body.experienceYears !== undefined) doctor.experience_years = Number(req.body.experienceYears);
      if (req.body.fee !== undefined) doctor.fee = Number(req.body.fee);
      if (req.body.consultationMinutes !== undefined) doctor.consultation_minutes = Number(req.body.consultationMinutes);
      if (req.body.consultationMode !== undefined) doctor.consultation_mode = req.body.consultationMode;
      if (req.body.bio !== undefined) doctor.bio = req.body.bio.trim();
      return doctorView(state, doctor);
    });
    res.json({ data: result });
  }));

router.get('/specialisations', asyncHandler(async (_req, res) => {
  const { specialisations } = await readData();
  res.json({ data: specialisations.sort((a, b) => a.name.localeCompare(b.name)) });
}));

router.post('/specialisations', body('name').trim().isLength({ min: 2, max: 100 }), body('description').optional().trim().isLength({ max: 500 }), validate, asyncHandler(async (req, res) => {
  const created = await updateData((state) => {
    const name = req.body.name.trim();
    if (state.specialisations.some((entry) => entry.name.toLowerCase() === name.toLowerCase())) throw new HttpError(409, 'That specialisation already exists.');
    const item = { id: nextId(state.specialisations), name, description: req.body.description || '' };
    state.specialisations.push(item);
    return item;
  });
  res.status(201).json({ data: created });
}));

router.put('/specialisations/:id', param('id').isInt({ min: 1 }), body('name').trim().isLength({ min: 2, max: 100 }), body('description').optional().trim().isLength({ max: 500 }), validate, asyncHandler(async (req, res) => {
  const updated = await updateData((state) => {
    const item = state.specialisations.find((entry) => Number(entry.id) === Number(req.params.id));
    if (!item) throw new HttpError(404, 'Specialisation not found.');
    const name = req.body.name.trim();
    if (state.specialisations.some((entry) => Number(entry.id) !== Number(item.id) && entry.name.toLowerCase() === name.toLowerCase())) throw new HttpError(409, 'That specialisation already exists.');
    item.name = name;
    item.description = req.body.description || '';
    return item;
  });
  res.json({ data: updated });
}));

router.delete('/specialisations/:id', param('id').isInt({ min: 1 }), validate, asyncHandler(async (req, res) => {
  await updateData((state) => {
    const index = state.specialisations.findIndex((entry) => Number(entry.id) === Number(req.params.id));
    if (index < 0) throw new HttpError(404, 'Specialisation not found.');
    if (state.doctors.some((doctor) => Number(doctor.specialisation_id) === Number(req.params.id))) throw new HttpError(409, 'This specialisation is assigned to a doctor and cannot be removed.');
    state.specialisations.splice(index, 1);
  });
  res.status(204).end();
}));

export default router;
