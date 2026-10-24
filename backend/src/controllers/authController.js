import { registerPatient, login } from '../services/authService.js';
import { readData } from '../services/jsonStore.js';
import { asyncHandler } from '../utils/http.js';

export const register = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await registerPatient(req.body) });
});

export const signIn = asyncHandler(async (req, res) => {
  res.json({ data: await login(req.body) });
});

export const currentUser = asyncHandler(async (req, res) => {
  const user = { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role };
  if (user.role === 'doctor') {
    const state = await readData();
    const doctor = state.doctors.find((entry) => Number(entry.user_id) === Number(user.id));
    const specialisation = state.specialisations.find((entry) => Number(entry.id) === Number(doctor?.specialisation_id));
    user.doctor = doctor ? { ...doctor, doctor_id: doctor.id, consultation_mode: doctor.consultation_mode || 'In-person', specialisation: specialisation?.name || '' } : null;
  }
  res.json({ data: user });
});
