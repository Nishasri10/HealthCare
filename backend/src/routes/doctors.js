import { Router } from 'express';
import { body, param, query as queryParam } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { readData, nextId, updateData } from '../services/jsonStore.js';
import { HttpError, asyncHandler } from '../utils/http.js';
import { clinicDateBoundsToUtc } from '../utils/time.js';

const router = Router();
const activeStatuses = ['booked', 'confirmed'];

function doctorView(state, doctor) {
  const user = state.users.find((entry) => Number(entry.id) === Number(doctor.user_id));
  const specialisation = state.specialisations.find((entry) => Number(entry.id) === Number(doctor.specialisation_id));
  const nextSlot = state.availability
    .filter((slot) => Number(slot.doctor_id) === Number(doctor.id) && new Date(slot.starts_at) > new Date() && isSlotAvailable(state, slot))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  return {
    id: doctor.id, specialisation_id: doctor.specialisation_id,
    name: user?.name, is_active: user?.is_active, specialisation: specialisation?.name,
    qualification: doctor.qualification, experience_years: doctor.experience_years, fee: doctor.fee,
    consultation_minutes: doctor.consultation_minutes, consultation_mode: doctor.consultation_mode || 'In-person',
    languages: Array.isArray(doctor.languages) ? doctor.languages : [],
    bio: doctor.bio, available: Boolean(nextSlot), next_available_at: nextSlot?.starts_at || null
  };
}

function isSlotAvailable(state, slot) {
  const slotStart = new Date(slot.starts_at).getTime();
  const slotEnd = new Date(slot.ends_at).getTime();
  return !state.appointments.some((appointment) => {
    if (Number(appointment.doctor_id) !== Number(slot.doctor_id) || !activeStatuses.includes(appointment.status)) return false;
    const bookedSlot = state.availability.find((entry) => Number(entry.id) === Number(appointment.slot_id));
    return bookedSlot && new Date(bookedSlot.starts_at).getTime() < slotEnd && new Date(bookedSlot.ends_at).getTime() > slotStart;
  });
}

router.get('/', [
  queryParam('search').optional().trim().isLength({ max: 100 }),
  queryParam('specialisation').optional().isInt({ min: 1 }),
  queryParam('page').optional().isInt({ min: 1, max: 100000 }),
  queryParam('limit').optional().isInt({ min: 1, max: 50 }),
  queryParam('mode').optional().isIn(['In-person', 'Online', 'Both']),
  queryParam('availability').optional().isIn(['available', 'unavailable']),
  queryParam('minFee').optional().isFloat({ min: 0, max: 100000 }),
  queryParam('maxFee').optional().isFloat({ min: 0, max: 100000 }),
  queryParam('sort').optional().isIn(['name', 'experience', 'fee']),
  queryParam('availableOn').optional().isISO8601({ strict: true }).matches(/^\d{4}-\d{2}-\d{2}$/).bail().custom((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }), validate
], asyncHandler(async (req, res) => {
  const state = await readData();
  if (req.query.minFee !== undefined && req.query.maxFee !== undefined && Number(req.query.minFee) > Number(req.query.maxFee)) {
    throw new HttpError(400, 'Minimum consultation fee cannot be greater than the maximum fee.');
  }
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 12);
  const search = String(req.query.search || '').trim().toLowerCase();
  const bounds = req.query.availableOn ? clinicDateBoundsToUtc(req.query.availableOn) : null;
  const start = bounds && new Date(`${bounds.start.replace(' ', 'T')}Z`);
  const end = bounds && new Date(`${bounds.end.replace(' ', 'T')}Z`);
  const filtered = state.doctors
    .filter((doctor) => {
      const profile = doctorView(state, doctor);
      if (!profile.is_active || (req.query.specialisation && Number(doctor.specialisation_id) !== Number(req.query.specialisation))) return false;
      if (search && ![profile.name, profile.specialisation, profile.qualification, ...profile.languages]
        .some((value) => String(value || '').toLowerCase().includes(search))) return false;
      if (req.query.mode && profile.consultation_mode !== req.query.mode && profile.consultation_mode !== 'Both') return false;
      if (req.query.minFee !== undefined && Number(profile.fee) < Number(req.query.minFee)) return false;
      if (req.query.maxFee !== undefined && Number(profile.fee) > Number(req.query.maxFee)) return false;
      const hasAvailableSlot = state.availability.some((slot) => Number(slot.doctor_id) === Number(doctor.id)
        && new Date(slot.starts_at) > new Date()
        && (!bounds || (new Date(slot.starts_at) >= start && new Date(slot.starts_at) < end))
        && isSlotAvailable(state, slot));
      if (bounds && !hasAvailableSlot) return false;
      if (req.query.availability === 'available' && !profile.available) return false;
      if (req.query.availability === 'unavailable' && profile.available) return false;
      return true;
    })
    .sort((a, b) => {
      const first = doctorView(state, a);
      const second = doctorView(state, b);
      if (req.query.sort === 'experience') return Number(second.experience_years) - Number(first.experience_years) || first.name.localeCompare(second.name);
      if (req.query.sort === 'fee') return Number(first.fee) - Number(second.fee) || first.name.localeCompare(second.name);
      return first.name.localeCompare(second.name);
    });
  const doctors = filtered
    .slice((page - 1) * limit, page * limit + 1)
    .map((doctor) => doctorView(state, doctor));
  const hasMore = doctors.length > limit;
  res.json({ data: doctors.slice(0, limit), pagination: { page, limit, hasMore } });
}));

router.get('/specialisations', asyncHandler(async (_req, res) => {
  const { specialisations } = await readData();
  res.json({ data: specialisations.sort((a, b) => a.name.localeCompare(b.name)) });
}));

router.get('/self/availability', authenticate, authorize('doctor'), asyncHandler(async (req, res) => {
  const state = await readData();
  const doctor = state.doctors.find((entry) => Number(entry.user_id) === Number(req.user.id));
  const slots = doctor ? state.availability
    .filter((slot) => Number(slot.doctor_id) === Number(doctor.id) && new Date(slot.starts_at) >= new Date())
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 200)
    .map((slot) => ({
      ...slot, is_booked: !isSlotAvailable(state, slot),
      has_history: state.appointments.some((appointment) => Number(appointment.slot_id) === Number(slot.id))
    })) : [];
  res.json({ data: slots });
}));

router.get('/:id/slots', param('id').isInt({ min: 1 }), validate, asyncHandler(async (req, res) => {
  const state = await readData();
  const doctor = state.doctors.find((entry) => Number(entry.id) === Number(req.params.id));
  const user = state.users.find((entry) => Number(entry.id) === Number(doctor?.user_id));
  if (!user?.is_active) throw new HttpError(404, 'Doctor not found.');
  const slots = state.availability.filter((slot) => Number(slot.doctor_id) === Number(doctor.id)
    && new Date(slot.starts_at) > new Date() && isSlotAvailable(state, slot))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 100);
  res.json({ data: slots });
}));

router.get('/:id', param('id').isInt({ min: 1 }), validate, asyncHandler(async (req, res) => {
  const state = await readData();
  const doctor = state.doctors.find((entry) => Number(entry.id) === Number(req.params.id));
  if (!doctor || !state.users.find((entry) => Number(entry.id) === Number(doctor.user_id))?.is_active) throw new HttpError(404, 'Doctor not found.');
  res.json({ data: doctorView(state, doctor) });
}));

router.post('/availability', authenticate, authorize('doctor'), [
  body('startsAt').isISO8601({ strict: true }).matches(/(?:Z|[+-]\d{2}:\d{2})$/),
  body('endsAt').isISO8601({ strict: true }).matches(/(?:Z|[+-]\d{2}:\d{2})$/), validate
], asyncHandler(async (req, res) => {
  const created = await updateData((state) => {
    const doctor = state.doctors.find((entry) => Number(entry.user_id) === Number(req.user.id));
    if (!doctor) throw new HttpError(404, 'Doctor profile not found.');
    const user = state.users.find((entry) => Number(entry.id) === Number(req.user.id));
    if (!user?.is_active) throw new HttpError(409, 'Your doctor account is inactive.');
    const start = new Date(req.body.startsAt);
    const end = new Date(req.body.endsAt);
    const duration = (end - start) / 60000;
    if (!Number.isFinite(duration) || start <= new Date() || duration !== Number(doctor.consultation_minutes)) {
      throw new HttpError(400, 'Slot must be in the future and match your configured consultation duration.');
    }
    if (state.availability.some((slot) => Number(slot.doctor_id) === Number(doctor.id)
      && new Date(slot.starts_at) < end && new Date(slot.ends_at) > start)) {
      throw new HttpError(409, 'This time overlaps with an existing availability slot.');
    }
    const slot = { id: nextId(state.availability), doctor_id: doctor.id, starts_at: start.toISOString(), ends_at: end.toISOString() };
    state.availability.push(slot);
    return slot;
  });
  res.status(201).json({ data: created });
}));

router.delete('/availability/:id', authenticate, authorize('doctor'), param('id').isInt({ min: 1 }), validate, asyncHandler(async (req, res) => {
  await updateData((state) => {
    const doctor = state.doctors.find((entry) => Number(entry.user_id) === Number(req.user.id));
    const slotIndex = state.availability.findIndex((entry) => Number(entry.id) === Number(req.params.id) && Number(entry.doctor_id) === Number(doctor?.id));
    const slot = state.availability[slotIndex];
    if (!slot || new Date(slot.starts_at) <= new Date()) throw new HttpError(409, 'This slot cannot be removed because it is past or unavailable.');
    if (state.appointments.some((appointment) => Number(appointment.slot_id) === Number(slot.id))) throw new HttpError(409, 'This slot has appointment history and cannot be removed.');
    state.availability.splice(slotIndex, 1);
  });
  res.status(204).end();
}));

export default router;
