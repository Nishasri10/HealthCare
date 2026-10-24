import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { nextId, updateData } from '../src/services/jsonStore.js';
import { ensureDemoDirectory } from '../src/services/demoDirectory.js';

if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true'
  || !process.env.SEED_DEMO_PASSWORD || process.env.SEED_DEMO_PASSWORD.length < 12
  || Buffer.byteLength(process.env.SEED_DEMO_PASSWORD, 'utf8') > 72) {
  throw new Error('Demo seed is disabled by default. Set ALLOW_DEMO_SEED=true and a 12-72 character SEED_DEMO_PASSWORD in development only.');
}

const accounts = [
  ['patient.demo@healthcare.local', 'Avery Patient', 'patient'],
  ['doctor.demo@healthcare.local', 'Dr. Sam Rivera', 'doctor'],
  ['admin.demo@healthcare.local', 'Morgan Admin', 'admin']
];
const passwordHash = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD, 12);
await ensureDemoDirectory({ force: true });

await updateData((state) => {
  const users = {};
  for (const [email, name, role] of accounts) {
    let user = state.users.find((entry) => entry.email === email);
    if (user && user.role !== role) throw new Error(`Seed account ${email} already exists with a different role.`);
    if (!user) {
      user = { id: nextId(state.users), name, email, password_hash: passwordHash, role, is_active: true, created_at: new Date().toISOString() };
      state.users.push(user);
    }
    users[role] = user;
  }
  let specialisation = state.specialisations.find((entry) => entry.name === 'General Medicine');
  if (!specialisation) {
    specialisation = { id: nextId(state.specialisations), name: 'General Medicine', description: 'Primary care and preventive health' };
    state.specialisations.push(specialisation);
  }
  let doctor = state.doctors.find((entry) => Number(entry.user_id) === Number(users.doctor.id));
  if (!doctor) {
    doctor = {
      id: nextId(state.doctors), user_id: users.doctor.id, specialisation_id: specialisation.id,
      qualification: 'MBBS, MD', experience_years: 8, fee: 45, consultation_minutes: 30,
      bio: 'Fictional family physician focused on preventive and primary care.'
    };
    state.doctors.push(doctor);
  }
  if (!state.availability.some((slot) => Number(slot.doctor_id) === Number(doctor.id) && new Date(slot.starts_at) > new Date())) {
    const first = new Date();
    first.setUTCDate(first.getUTCDate() + 1);
    first.setUTCHours(9, 0, 0, 0);
    for (let day = 0; day < 5; day += 1) {
      for (let index = 0; index < 4; index += 1) {
        const start = new Date(first.getTime() + day * 86400000 + index * 30 * 60000);
        const end = new Date(start.getTime() + 30 * 60000);
        state.availability.push({ id: nextId(state.availability), doctor_id: doctor.id, starts_at: start.toISOString(), ends_at: end.toISOString() });
      }
    }
  }
  const alreadyHasAppointment = state.appointments.some((entry) => Number(entry.patient_id) === Number(users.patient.id));
  if (!alreadyHasAppointment) {
    const slot = state.availability.find((entry) => Number(entry.doctor_id) === Number(doctor.id)
      && new Date(entry.starts_at) > new Date()
      && !state.appointments.some((appointment) => Number(appointment.slot_id) === Number(entry.id) && ['booked', 'confirmed'].includes(appointment.status)));
    if (slot) state.appointments.push({
      id: nextId(state.appointments), patient_id: users.patient.id, doctor_id: doctor.id, slot_id: slot.id,
      reason: 'Fictional routine wellness consultation', status: 'booked',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
  }
});

console.log('Fictional development data created or preserved.');
console.log('Demo accounts: patient.demo@healthcare.local, doctor.demo@healthcare.local, admin.demo@healthcare.local');
console.log('Demo accounts share the SEED_DEMO_PASSWORD value used for this run.');
