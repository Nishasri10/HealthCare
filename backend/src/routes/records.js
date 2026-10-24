import { Router } from 'express';
import { body, param } from 'express-validator';
import { readData, nextId, updateData } from '../services/jsonStore.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { HttpError, asyncHandler } from '../utils/http.js';

const router = Router();

function recordView(state, record) {
  const appointment = state.appointments.find((entry) => Number(entry.id) === Number(record.appointment_id));
  const slot = state.availability.find((entry) => Number(entry.id) === Number(appointment?.slot_id));
  const doctor = state.doctors.find((entry) => Number(entry.id) === Number(record.doctor_id));
  const doctorUser = state.users.find((entry) => Number(entry.id) === Number(doctor?.user_id));
  const patient = state.users.find((entry) => Number(entry.id) === Number(record.patient_id));
  return { ...record, slot_id: slot?.id, starts_at: slot?.starts_at, doctor_name: doctorUser?.name, patient_name: patient?.name };
}

router.post('/', authenticate, authorize('doctor'), [
  body('appointmentId').isInt({ min: 1 }),
  body('diagnosis').trim().isLength({ min: 2, max: 2000 }),
  body('prescription').optional().trim().isLength({ max: 5000 }),
  body('notes').optional().trim().isLength({ max: 5000 }),
  body('followUp').optional().trim().isLength({ max: 5000 }),
  validate
], asyncHandler(async (req, res) => {
  const result = await updateData((state) => {
    const doctor = state.doctors.find((entry) => Number(entry.user_id) === Number(req.user.id));
    const appointment = state.appointments.find((entry) => Number(entry.id) === Number(req.body.appointmentId));
    if (!doctor || !appointment || Number(appointment.doctor_id) !== Number(doctor.id)) throw new HttpError(404, 'Completed appointment not found.');
    if (appointment.status !== 'completed') throw new HttpError(409, 'A medical record can only be created for a completed appointment.');
    if (state['medical-records'].some((record) => Number(record.appointment_id) === Number(appointment.id))) {
      throw new HttpError(409, 'A medical record already exists for this appointment.');
    }
    const record = {
      id: nextId(state['medical-records']), appointment_id: appointment.id, patient_id: appointment.patient_id,
      doctor_id: doctor.id, diagnosis: req.body.diagnosis.trim(), prescription: (req.body.prescription || '').trim(),
      notes: (req.body.notes || '').trim(), follow_up: (req.body.followUp || '').trim(), created_at: new Date().toISOString()
    };
    state['medical-records'].push(record);
    return record;
  });
  res.status(201).json({ data: { id: result.id, appointment_id: result.appointment_id } });
}));

router.get('/my', authenticate, authorize('patient', 'doctor'), asyncHandler(async (req, res) => {
  const state = await readData();
  const doctor = req.user.role === 'doctor' ? state.doctors.find((entry) => Number(entry.user_id) === Number(req.user.id)) : null;
  const records = state['medical-records']
    .filter((record) => req.user.role === 'patient'
      ? Number(record.patient_id) === Number(req.user.id)
      : doctor && Number(record.doctor_id) === Number(doctor.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 200)
    .map((record) => recordView(state, record));
  res.json({ data: records });
}));

router.get('/:id', authenticate, param('id').isInt({ min: 1 }), validate, asyncHandler(async (req, res) => {
  const state = await readData();
  const record = state['medical-records'].find((entry) => Number(entry.id) === Number(req.params.id));
  if (!record) throw new HttpError(404, 'Medical record not found.');
  const doctor = req.user.role === 'doctor' ? state.doctors.find((entry) => Number(entry.user_id) === Number(req.user.id)) : null;
  const allowed = (req.user.role === 'patient' && Number(record.patient_id) === Number(req.user.id))
    || (doctor && Number(record.doctor_id) === Number(doctor.id));
  if (!allowed) throw new HttpError(404, 'Medical record not found.');
  res.json({ data: recordView(state, record) });
}));

export default router;
