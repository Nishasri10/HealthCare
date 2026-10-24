import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';

process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), 'healthcare-flow-test-'));
const { default: app } = await import('../src/app.js');
const { readData, updateData } = await import('../src/services/jsonStore.js');

const password = 'local-integration-test-password';
let tokens;
let appointmentId;

before(async () => {
  await readData();
  const passwordHash = await bcrypt.hash(password, 4);
  const future = new Date(Date.now() + 3 * 86400000);
  future.setUTCMinutes(0, 0, 0);
  const slot1 = new Date(future.getTime() + 3600000);
  const slot2 = new Date(future.getTime() + 7200000);
  const startPast = new Date(Date.now() - 86400000);
  const endPast = new Date(startPast.getTime() + 1800000);
  const activeVisitStart = new Date(Date.now() - 5 * 60000);
  const activeVisitEnd = new Date(Date.now() + 25 * 60000);
  await updateData((state) => {
    state.users.push(
      { id: 1, name: 'Patient One', email: 'patient.one@test.local', password_hash: passwordHash, role: 'patient', is_active: true, created_at: new Date().toISOString() },
      { id: 2, name: 'Patient Two', email: 'patient.two@test.local', password_hash: passwordHash, role: 'patient', is_active: true, created_at: new Date().toISOString() },
      { id: 3, name: 'Doctor Test', email: 'doctor@test.local', password_hash: passwordHash, role: 'doctor', is_active: true, created_at: new Date().toISOString() },
      { id: 4, name: 'Admin Test', email: 'admin@test.local', password_hash: passwordHash, role: 'admin', is_active: true, created_at: new Date().toISOString() },
      { id: 5, name: 'Dr. Zoe Sample', email: 'doctor.zoe@test.local', password_hash: passwordHash, role: 'doctor', is_active: true, created_at: new Date().toISOString() },
      { id: 6, name: 'Dr. No Slots', email: 'doctor.empty@test.local', password_hash: passwordHash, role: 'doctor', is_active: true, created_at: new Date().toISOString() }
    );
    state.specialisations.push({ id: 1, name: 'Family Medicine', description: 'Testing speciality' }, { id: 2, name: 'Cardiology', description: 'Testing speciality' });
    state.doctors.push(
      { id: 1, user_id: 3, specialisation_id: 1, qualification: 'MD', experience_years: 4, fee: 50, consultation_minutes: 30, consultation_mode: 'Online', bio: 'A fictional test profile for integration checks.' },
      { id: 2, user_id: 5, specialisation_id: 2, qualification: 'MD Cardiology', experience_years: 10, fee: 100, consultation_minutes: 30, consultation_mode: 'In-person', bio: 'A fictional second profile for filtering checks.' },
      { id: 3, user_id: 6, specialisation_id: 2, qualification: 'MD Cardiology', experience_years: 2, fee: 25, consultation_minutes: 30, consultation_mode: 'Both', bio: 'A fictional profile without slots for filtering checks.' }
    );
    state.availability.push(
      { id: 1, doctor_id: 1, starts_at: slot1.toISOString(), ends_at: new Date(slot1.getTime() + 1800000).toISOString() },
      { id: 2, doctor_id: 1, starts_at: slot2.toISOString(), ends_at: new Date(slot2.getTime() + 1800000).toISOString() },
      { id: 3, doctor_id: 1, starts_at: startPast.toISOString(), ends_at: endPast.toISOString() },
      { id: 4, doctor_id: 1, starts_at: new Date(slot1.getTime() + 900000).toISOString(), ends_at: new Date(slot1.getTime() + 2700000).toISOString() },
      { id: 5, doctor_id: 2, starts_at: new Date(slot1.getTime() + 4 * 3600000).toISOString(), ends_at: new Date(slot1.getTime() + 4 * 3600000 + 1800000).toISOString() },
      { id: 6, doctor_id: 1, starts_at: activeVisitStart.toISOString(), ends_at: activeVisitEnd.toISOString() }
    );
    state.appointments.push(
      { id: 1, patient_id: 1, doctor_id: 1, slot_id: 3, reason: 'Test visit', status: 'completed', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 2, patient_id: 2, doctor_id: 1, slot_id: 3, reason: 'Another test visit', status: 'completed', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 3, patient_id: 1, doctor_id: 1, slot_id: 3, reason: 'Second completed visit', status: 'completed', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 4, patient_id: 1, doctor_id: 1, slot_id: 6, reason: 'Current consultation', status: 'confirmed', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    );
    state['medical-records'].push(
      { id: 1, appointment_id: 1, patient_id: 1, doctor_id: 1, diagnosis: 'Private test diagnosis', notes: 'Patient-only content', prescription: '', follow_up: '', created_at: new Date().toISOString() },
      { id: 2, appointment_id: 2, patient_id: 2, doctor_id: 1, diagnosis: 'Another private diagnosis', notes: '', prescription: '', follow_up: '', created_at: new Date().toISOString() }
    );
  });
  tokens = {};
  for (const [role, email] of Object.entries({
    patient: 'patient.one@test.local', otherPatient: 'patient.two@test.local',
    doctor: 'doctor@test.local', admin: 'admin@test.local'
  })) {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    assert.equal(login.status, 200);
    tokens[role] = login.body.data.token;
  }
});

after(async () => rm(process.env.DATA_DIR, { recursive: true, force: true }));

test('simultaneous bookings for one slot cannot double-book', async () => {
  const payload = { doctorId: 1, slotId: 1, reason: 'Routine consultation' };
  const responses = await Promise.all([
    request(app).post('/api/appointments').set('Authorization', `Bearer ${tokens.patient}`).send(payload),
    request(app).post('/api/appointments').set('Authorization', `Bearer ${tokens.otherPatient}`).send(payload)
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  const state = await readData();
  assert.equal(state.appointments.filter((item) => Number(item.slot_id) === 1 && ['booked', 'confirmed'].includes(item.status)).length, 1);
  const overlap = await request(app).post('/api/appointments').set('Authorization', `Bearer ${tokens.otherPatient}`)
    .send({ doctorId: 1, slotId: 4, reason: 'Overlapping time' });
  assert.equal(overlap.status, 409);
  appointmentId = responses.find((response) => response.status === 201).body.data.id;
});

test('doctor directory supports search, speciality, mode, availability, fee, and sorting filters', async () => {
  const directory = await request(app).get('/api/doctors?limit=50');
  assert.equal(directory.status, 200);
  assert.equal(directory.body.data.length, 3);
  assert.equal(directory.body.data[0].consultation_mode, 'Online');
  assert.equal(directory.body.data[0].available, true);

  const search = await request(app).get('/api/doctors?search=zoe');
  assert.deepEqual(search.body.data.map((doctor) => doctor.name), ['Dr. Zoe Sample']);
  const speciality = await request(app).get('/api/doctors?specialisation=1');
  assert.deepEqual(speciality.body.data.map((doctor) => doctor.name), ['Doctor Test']);
  const mode = await request(app).get('/api/doctors?mode=Online');
  assert.deepEqual(mode.body.data.map((doctor) => doctor.name), ['Doctor Test', 'Dr. No Slots']);
  const inPerson = await request(app).get('/api/doctors?mode=In-person');
  assert.deepEqual(inPerson.body.data.map((doctor) => doctor.name), ['Dr. No Slots', 'Dr. Zoe Sample']);
  const available = await request(app).get('/api/doctors?availability=available');
  assert.equal(available.body.data.length, 2);
  const unavailable = await request(app).get('/api/doctors?availability=unavailable');
  assert.deepEqual(unavailable.body.data.map((doctor) => doctor.name), ['Dr. No Slots']);
  const fee = await request(app).get('/api/doctors?minFee=40&maxFee=60');
  assert.deepEqual(fee.body.data.map((doctor) => doctor.name), ['Doctor Test']);
  const sorted = await request(app).get('/api/doctors?sort=experience');
  assert.deepEqual(sorted.body.data.map((doctor) => doctor.name), ['Dr. Zoe Sample', 'Doctor Test', 'Dr. No Slots']);
  const invalidRange = await request(app).get('/api/doctors?minFee=100&maxFee=10');
  assert.equal(invalidRange.status, 400);
});

test('booking validation rejects invalid payloads and slots belonging to another doctor', async () => {
  const missingReason = await request(app).post('/api/appointments').set('Authorization', `Bearer ${tokens.patient}`)
    .send({ doctorId: 1, slotId: 2 });
  assert.equal(missingReason.status, 400);
  const wrongDoctorSlot = await request(app).post('/api/appointments').set('Authorization', `Bearer ${tokens.patient}`)
    .send({ doctorId: 1, slotId: 5, reason: 'Routine consultation' });
  assert.equal(wrongDoctorSlot.status, 404);
});

test('patient ownership and administrator clinical-data restrictions are enforced', async () => {
  const patientRecord = await request(app).get('/api/records/1').set('Authorization', `Bearer ${tokens.patient}`);
  assert.equal(patientRecord.status, 200);
  const otherRecord = await request(app).get('/api/records/2').set('Authorization', `Bearer ${tokens.patient}`);
  assert.equal(otherRecord.status, 404);
  const adminRecord = await request(app).get('/api/records/1').set('Authorization', `Bearer ${tokens.admin}`);
  assert.equal(adminRecord.status, 404);
  const adminRecordList = await request(app).get('/api/records/my').set('Authorization', `Bearer ${tokens.admin}`);
  assert.equal(adminRecordList.status, 403);
  const doctorRecord = await request(app).get('/api/records/1').set('Authorization', `Bearer ${tokens.doctor}`);
  assert.equal(doctorRecord.status, 200);
});

test('patients can cancel an owned future appointment, but cannot cancel twice', async () => {
  const first = await request(app).patch(`/api/appointments/${appointmentId}/status`)
    .set('Authorization', `Bearer ${tokens.patient}`).send({ status: 'cancelled' });
  assert.equal(first.status, 200);
  assert.equal(first.body.data.status, 'cancelled');
  const second = await request(app).patch(`/api/appointments/${appointmentId}/status`)
    .set('Authorization', `Bearer ${tokens.patient}`).send({ status: 'cancelled' });
  assert.equal(second.status, 409);
});

test('doctors cannot complete an appointment before its scheduled end time', async () => {
  const response = await request(app).patch('/api/appointments/4/status')
    .set('Authorization', `Bearer ${tokens.doctor}`).send({ status: 'completed' });
  assert.equal(response.status, 400);
  assert.match(response.body.error.message, /scheduled end time/);
  const state = await readData();
  assert.equal(state.appointments.find((item) => item.id === 4).status, 'confirmed');
});

test('doctors can create one record only for their own completed appointment', async () => {
  const create = await request(app).post('/api/records').set('Authorization', `Bearer ${tokens.doctor}`).send({
    appointmentId: 3, diagnosis: 'Follow-up check', notes: 'Private note'
  });
  assert.equal(create.status, 201);
  const duplicate = await request(app).post('/api/records').set('Authorization', `Bearer ${tokens.doctor}`).send({
    appointmentId: 3, diagnosis: 'Duplicate record'
  });
  assert.equal(duplicate.status, 409);
  const unauthorized = await request(app).post('/api/records').set('Authorization', `Bearer ${tokens.patient}`).send({
    appointmentId: 3, diagnosis: 'Not allowed'
  });
  assert.equal(unauthorized.status, 403);
});

test('administrator operations expose safe summaries and can manage users/specialisations', async () => {
  const auth = { Authorization: `Bearer ${tokens.admin}` };
  const dashboard = await request(app).get('/api/admin/dashboard').set(auth);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.data.totals.patients, 2);
  assert.equal(Object.hasOwn(dashboard.body.data, 'medicalRecords'), false);

  const users = await request(app).get('/api/admin/users').set(auth);
  assert.equal(users.status, 200);
  assert.equal(users.body.data.some((user) => Object.hasOwn(user, 'password_hash')), false);
  const appointments = await request(app).get('/api/admin/appointments').set(auth);
  assert.equal(appointments.status, 200);
  assert.equal(appointments.body.data.every((item) => !Object.hasOwn(item, 'reason')), true);
  const appointmentDetail = await request(app).get(`/api/appointments/${appointmentId}`).set(auth);
  assert.equal(appointmentDetail.status, 200);
  assert.equal(Object.hasOwn(appointmentDetail.body.data, 'reason'), false);

  const disabled = await request(app).patch('/api/admin/users/2/status').set(auth).send({ isActive: false });
  assert.equal(disabled.status, 200);
  const reenabled = await request(app).patch('/api/admin/users/2/status').set(auth).send({ isActive: true });
  assert.equal(reenabled.status, 200);

  const created = await request(app).post('/api/admin/specialisations').set(auth).send({ name: 'Test speciality' });
  assert.equal(created.status, 201);
  const changed = await request(app).put(`/api/admin/specialisations/${created.body.data.id}`).set(auth).send({ name: 'Renamed speciality' });
  assert.equal(changed.status, 200);
  const removed = await request(app).delete(`/api/admin/specialisations/${created.body.data.id}`).set(auth);
  assert.equal(removed.status, 204);
});
