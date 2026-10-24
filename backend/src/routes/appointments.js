import { Router } from 'express';
import { body, param } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { readData, nextId, updateData } from '../services/jsonStore.js';
import { HttpError, asyncHandler } from '../utils/http.js';

const router = Router();
const activeStatuses = ['booked', 'confirmed'];

function appointmentView(state, appointment) {
  const slot = state.availability.find((entry) => Number(entry.id) === Number(appointment.slot_id));
  const doctor = state.doctors.find((entry) => Number(entry.id) === Number(appointment.doctor_id));
  const doctorUser = state.users.find((entry) => Number(entry.id) === Number(doctor?.user_id));
  const patient = state.users.find((entry) => Number(entry.id) === Number(appointment.patient_id));
  const specialisation = state.specialisations.find((entry) => Number(entry.id) === Number(doctor?.specialisation_id));
  return {
    ...appointment, starts_at: slot?.starts_at, ends_at: slot?.ends_at,
    doctor_name: doctorUser?.name, patient_name: patient?.name, specialisation: specialisation?.name
  };
}

function overlaps(state, doctorId, slot, exceptAppointmentId) {
  const start = new Date(slot.starts_at).getTime();
  const end = new Date(slot.ends_at).getTime();
  return state.appointments.some((appointment) => {
    if (!activeStatuses.includes(appointment.status) || Number(appointment.doctor_id) !== Number(doctorId)
      || Number(appointment.id) === Number(exceptAppointmentId)) return false;
    const other = state.availability.find((entry) => Number(entry.id) === Number(appointment.slot_id));
    return other && new Date(other.starts_at).getTime() < end && new Date(other.ends_at).getTime() > start;
  });
}

router.post('/', authenticate, authorize('patient'), [
  body('doctorId').isInt({ min: 1 }), body('slotId').isInt({ min: 1 }),
  body('reason').trim().isLength({ min: 3, max: 1000 }), validate
], asyncHandler(async (req, res) => {
  const appointment = await updateData((state) => {
    const doctor = state.doctors.find((entry) => Number(entry.id) === Number(req.body.doctorId));
    const doctorUser = state.users.find((entry) => Number(entry.id) === Number(doctor?.user_id));
    if (!doctor || !doctorUser?.is_active) throw new HttpError(404, 'This doctor is not available.');
    const slot = state.availability.find((entry) => Number(entry.id) === Number(req.body.slotId) && Number(entry.doctor_id) === Number(doctor.id));
    if (!slot || new Date(slot.starts_at) <= new Date()) throw new HttpError(404, 'This appointment time is no longer available.');
    if (overlaps(state, doctor.id, slot)) throw new HttpError(409, 'This appointment time has already been booked.');
    const created = { id: nextId(state.appointments), patient_id: req.user.id, doctor_id: doctor.id, slot_id: slot.id, reason: req.body.reason.trim(), status: 'booked', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    state.appointments.push(created);
    return created;
  });
  res.status(201).json({ data: { id: appointment.id, status: appointment.status } });
}));

router.get('/my', authenticate, asyncHandler(async (req, res) => {
  const state = await readData();
  let doctor = null;
  if (req.user.role === 'doctor') doctor = state.doctors.find((entry) => Number(entry.user_id) === Number(req.user.id));
  if (!['patient', 'doctor'].includes(req.user.role)) throw new HttpError(403, 'You do not have permission to view these appointments.');
  const rows = state.appointments
    .filter((entry) => req.user.role === 'patient' ? Number(entry.patient_id) === Number(req.user.id) : doctor && Number(entry.doctor_id) === Number(doctor.id))
    .sort((a, b) => new Date(state.availability.find((slot) => Number(slot.id) === Number(b.slot_id))?.starts_at || 0) - new Date(state.availability.find((slot) => Number(slot.id) === Number(a.slot_id))?.starts_at || 0))
    .slice(0, 200).map((entry) => appointmentView(state, entry));
  res.json({ data: rows });
}));

router.get('/:id', authenticate, param('id').isInt({ min: 1 }), validate, asyncHandler(async (req, res) => {
  const state = await readData();
  const appointment = state.appointments.find((entry) => Number(entry.id) === Number(req.params.id));
  if (!appointment) throw new HttpError(404, 'Appointment not found.');
  const doctor = req.user.role === 'doctor' && state.doctors.find((entry) => Number(entry.user_id) === Number(req.user.id));
  if ((req.user.role === 'patient' && Number(appointment.patient_id) !== Number(req.user.id))
    || (req.user.role === 'doctor' && (!doctor || Number(appointment.doctor_id) !== Number(doctor.id)))
    || !['patient', 'doctor', 'admin'].includes(req.user.role)) throw new HttpError(404, 'Appointment not found.');
  const result = appointmentView(state, appointment);
  if (req.user.role === 'admin') delete result.reason;
  res.json({ data: result });
}));

router.patch('/:id/status', authenticate, param('id').isInt({ min: 1 }), body('status').isIn(['confirmed', 'declined', 'completed', 'cancelled']), validate, asyncHandler(async (req, res) => {
  const updated = await updateData((state) => {
    const appointment = state.appointments.find((entry) => Number(entry.id) === Number(req.params.id));
    if (!appointment) throw new HttpError(404, 'Appointment not found.');
    const slot = state.availability.find((entry) => Number(entry.id) === Number(appointment.slot_id));
    const next = req.body.status;
    const isPatient = req.user.role === 'patient' && Number(appointment.patient_id) === Number(req.user.id);
    const doctor = req.user.role === 'doctor' && state.doctors.find((entry) => Number(entry.user_id) === Number(req.user.id));
    const isDoctor = doctor && Number(doctor.id) === Number(appointment.doctor_id);
    if (req.user.role === 'admin') throw new HttpError(403, 'Administrators cannot change appointment status.');
    if (!isPatient && !isDoctor) throw new HttpError(404, 'Appointment not found.');
    const allowed = (isPatient && next === 'cancelled' && activeStatuses.includes(appointment.status))
      || (isDoctor && appointment.status === 'booked' && ['confirmed', 'declined'].includes(next))
      || (isDoctor && appointment.status === 'confirmed' && next === 'completed');
    if (!allowed) throw new HttpError(409, 'This appointment status transition is not allowed.');
    const startsAt = new Date(slot?.starts_at || 0);
    const endsAt = new Date(slot?.ends_at || 0);
    if (next === 'confirmed' && startsAt <= new Date()) throw new HttpError(400, 'A past appointment cannot be confirmed.');
    if (next === 'completed' && endsAt > new Date()) throw new HttpError(400, 'An appointment cannot be completed before its scheduled end time.');
    if (next === 'cancelled' && startsAt <= new Date()) throw new HttpError(400, 'A past appointment cannot be cancelled.');
    appointment.status = next;
    appointment.updated_at = new Date().toISOString();
    return appointment;
  });
  res.json({ data: { id: updated.id, status: updated.status } });
}));

router.put('/:id/reschedule', authenticate, authorize('patient'), param('id').isInt({ min: 1 }), body('slotId').isInt({ min: 1 }), validate, asyncHandler(async (req, res) => {
  const updated = await updateData((state) => {
    const appointment = state.appointments.find((entry) => Number(entry.id) === Number(req.params.id) && Number(entry.patient_id) === Number(req.user.id));
    if (!appointment) throw new HttpError(404, 'Appointment not found.');
    const doctor = state.doctors.find((entry) => Number(entry.id) === Number(appointment.doctor_id));
    const doctorUser = state.users.find((entry) => Number(entry.id) === Number(doctor?.user_id));
    if (!doctorUser?.is_active) throw new HttpError(409, 'This doctor is no longer available for rescheduling.');
    const oldSlot = state.availability.find((entry) => Number(entry.id) === Number(appointment.slot_id));
    if (!oldSlot || new Date(oldSlot.starts_at) <= new Date()) throw new HttpError(409, 'A past appointment cannot be rescheduled.');
    if (!activeStatuses.includes(appointment.status)) throw new HttpError(409, 'This appointment cannot be rescheduled.');
    if (Number(appointment.slot_id) === Number(req.body.slotId)) throw new HttpError(400, 'Choose a different appointment time.');
    const slot = state.availability.find((entry) => Number(entry.id) === Number(req.body.slotId));
    if (!slot || Number(slot.doctor_id) !== Number(appointment.doctor_id)) throw new HttpError(400, 'Choose an available time with the same doctor.');
    if (new Date(slot.starts_at) <= new Date()) throw new HttpError(400, 'Appointments must be rescheduled to a future time.');
    if (overlaps(state, appointment.doctor_id, slot, appointment.id)) throw new HttpError(409, 'This appointment time has already been booked.');
    appointment.slot_id = slot.id;
    appointment.status = 'booked';
    appointment.updated_at = new Date().toISOString();
    return appointment;
  });
  res.json({ data: { id: updated.id, status: updated.status, slot_id: updated.slot_id } });
}));

export default router;
