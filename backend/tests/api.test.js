import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import request from 'supertest';

process.env.JWT_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.CLINIC_TIMEZONE = 'Asia/Kolkata';
process.env.DATA_DIR = await mkdtemp(path.join(tmpdir(), 'healthcare-api-test-'));
const { corsAllowedOrigins, default: app } = await import('../src/app.js');
const { nextId, readData, updateData } = await import('../src/services/jsonStore.js');

after(async () => rm(process.env.DATA_DIR, { recursive: true, force: true }));

test('health endpoint and security headers respond without an external database', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { data: { status: 'ok' } });
  assert.ok(response.headers['x-content-type-options']);
});

test('development CORS allows configured localhost aliases but not unrelated origins', async () => {
  const localhost = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
  assert.equal(localhost.headers['access-control-allow-origin'], 'http://localhost:5173');
  const loopback = await request(app).get('/api/health').set('Origin', 'http://127.0.0.1:5173');
  assert.equal(loopback.headers['access-control-allow-origin'], 'http://127.0.0.1:5173');
  const unrelated = await request(app).get('/api/health').set('Origin', 'http://example.test');
  assert.equal(unrelated.headers['access-control-allow-origin'], undefined);
});

test('production CORS requires and allows only one valid frontend origin', () => {
  assert.deepEqual(corsAllowedOrigins('production', 'https://carepoint.example'), ['https://carepoint.example']);
  assert.throws(() => corsAllowedOrigins('production', ''), /FRONTEND_ORIGIN must be set/);
  assert.throws(() => corsAllowedOrigins('production', 'https://carepoint.example/'), /must be an origin only/);
});

test('JSON storage rejects a relative DATA_DIR', () => {
  const storeUrl = new URL('../src/services/jsonStore.js', import.meta.url).href;
  assert.throws(() => execFileSync(process.execPath, ['--input-type=module', '-e',
    `process.env.DATA_DIR = 'relative-data'; await import(${JSON.stringify(storeUrl)});`
  ], { encoding: 'utf8', stdio: 'pipe' }), /DATA_DIR must be an absolute path/);
});

test('protected endpoints reject unauthenticated requests', async () => {
  const response = await request(app).get('/api/records/my');
  assert.equal(response.status, 401);
  assert.equal(response.body.error.message, 'Authentication is required.');
});

test('JWT verification rejects malformed, expired, and disallowed-algorithm tokens', async () => {
  const tokens = [
    'not-a-jwt',
    jwt.sign({ sub: '1' }, process.env.JWT_SECRET, { algorithm: 'HS384' }),
    jwt.sign({ sub: '1' }, process.env.JWT_SECRET, { expiresIn: -1 })
  ];
  for (const token of tokens) {
    const response = await request(app).get('/api/records/my').set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 401);
  }
});

test('unknown routes and invalid clinic dates return structured errors', async () => {
  const missing = await request(app).get('/api/not-a-real-route');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.message, 'Route not found.');
  const invalidDate = await request(app).get('/api/doctors?availableOn=2026-02-31');
  assert.equal(invalidDate.status, 400);
  const invalidPage = await request(app).get('/api/doctors?page=0');
  assert.equal(invalidPage.status, 400);
});

test('registration and login hash passwords and never expose stored hashes', async () => {
  const registration = await request(app).post('/api/auth/register').send({
    name: 'Test Patient', email: 'test.patient@example.test', password: 'long-local-test-password'
  });
  assert.equal(registration.status, 201);
  assert.equal(registration.body.data.role, 'patient');
  assert.equal(Object.hasOwn(registration.body.data, 'password_hash'), false);
  const state = await readData();
  assert.notEqual(state.users[0].password_hash, 'long-local-test-password');
  const login = await request(app).post('/api/auth/login').send({
    email: 'test.patient@example.test', password: 'long-local-test-password'
  });
  assert.equal(login.status, 200);
  const invalidLogin = await request(app).post('/api/auth/login').send({
    email: 'test.patient@example.test', password: 'wrong-password'
  });
  assert.equal(invalidLogin.status, 401);
});

test('fictional doctor directory seeding is safe, idempotent, and served by the API', async () => {
  const { directorySpecialities, ensureDemoDirectory } = await import('../src/services/demoDirectory.js');
  const registered = (await readData()).users.find((user) => user.email === 'test.patient@example.test');
  await ensureDemoDirectory({ force: true });
  const firstState = await readData();
  assert.equal(firstState.doctors.length, 35);
  assert.equal(firstState.specialisations.length, 30);
  assert.ok(firstState.specialisations.every((speciality) => speciality.id));
  assert.ok(firstState.doctors.every((doctor) => Array.isArray(doctor.languages) && doctor.languages.length));
  assert.equal(firstState.users.find((user) => user.email === registered.email).password_hash, registered.password_hash);
  const users = firstState.users.length;
  const availability = firstState.availability.length;
  const orthopedics = firstState.specialisations.find((item) => item.name === 'Orthopedics');
  const demoOrthopedist = firstState.doctors.find((doctor) => Number(doctor.specialisation_id) === Number(orthopedics.id));
  const aliasId = nextId(firstState.specialisations);
  await updateData((state) => {
    state.specialisations.push({ id: aliasId, name: 'Orthopaedics', description: 'Legacy speciality alias' });
    state.doctors.find((doctor) => Number(doctor.id) === Number(demoOrthopedist.id)).specialisation_id = aliasId;
  });
  await ensureDemoDirectory({ force: true });
  const secondState = await readData();
  assert.equal(secondState.doctors.length, 35);
  assert.equal(secondState.specialisations.length, 30);
  assert.equal(secondState.users.length, users);
  assert.equal(secondState.availability.length, availability);
  assert.equal(secondState.doctors.find((doctor) => Number(doctor.id) === Number(demoOrthopedist.id)).specialisation_id, orthopedics.id);
  const response = await request(app).get('/api/doctors?limit=50');
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 35);
  assert.ok(response.body.data.every((doctor) => doctor.available && doctor.consultation_mode && doctor.languages.length));
  const specialities = await request(app).get('/api/doctors/specialisations');
  assert.equal(specialities.body.data.length, 30);
  assert.deepEqual(specialities.body.data.map((item) => item.name).sort(), [...directorySpecialities].sort());
  const filtered = await request(app).get(`/api/doctors?specialisation=${specialities.body.data.find((item) => item.name === 'Psychology').id}`);
  assert.equal(filtered.body.data.length, 1);
  assert.equal(filtered.body.data[0].specialisation, 'Psychology');
  const bySpecialitySearch = await request(app).get('/api/doctors?search=plastic%20surgery');
  assert.equal(bySpecialitySearch.body.data.length, 1);
  assert.equal(bySpecialitySearch.body.data[0].specialisation, 'Plastic Surgery');
  for (const speciality of specialities.body.data) {
    const result = await request(app).get(`/api/doctors?specialisation=${speciality.id}`);
    assert.ok(result.body.data.length >= 1, `Expected at least one demo doctor for ${speciality.name}.`);
  }
  const popularSpecialities = ['General Medicine', 'Cardiology', 'Dermatology', 'Pediatrics', 'Orthopedics'];
  for (const name of popularSpecialities) {
    const result = await request(app).get(`/api/doctors?specialisation=${specialities.body.data.find((item) => item.name === name).id}`);
    assert.ok(result.body.data.length >= 2, `Expected multiple demo doctors for ${name}.`);
  }
  const profile = await request(app).get(`/api/doctors/${response.body.data[0].id}`);
  assert.equal(profile.body.data.id, response.body.data[0].id);
  assert.ok(profile.body.data.languages.length > 0);
});

test('JSON files initialize, persist, and malformed data fails explicitly without resetting', async () => {
  const initial = await readData();
  assert.ok(Array.isArray(initial['medical-records']));
  await updateData((state) => state.specialisations.push({ id: nextId(state.specialisations), name: 'Test', description: '' }));
  assert.ok((await readData()).specialisations.some((item) => item.name === 'Test'));
  const storeUrl = new URL('../src/services/jsonStore.js', import.meta.url).href;
  const persistedValue = execFileSync(process.execPath, ['--input-type=module', '-e',
    `const store = await import(${JSON.stringify(storeUrl)}); console.log((await store.readData()).specialisations.find((item) => item.name === 'Test')?.name);`
  ], { env: process.env, encoding: 'utf8' }).trim();
  assert.equal(persistedValue, 'Test');
  const originalSpecialities = await (await import('node:fs/promises')).readFile(path.join(process.env.DATA_DIR, 'specialisations.json'), 'utf8');
  const file = path.join(process.env.DATA_DIR, 'specialisations.json');
  await writeFile(file, '{not valid JSON');
  await assert.rejects(readData(), /malformed JSON/);
  assert.equal(await (await import('node:fs/promises')).readFile(file, 'utf8'), '{not valid JSON');
  await writeFile(file, originalSpecialities);
  await writeFile(path.join(process.env.DATA_DIR, 'availability.json'), JSON.stringify([
    { id: 1, doctor_id: 1, starts_at: '2026-01-02T12:00:00.000Z', ends_at: '2026-01-02T11:00:00.000Z' }
  ]));
  await assert.rejects(readData(), /valid availability records/);
});
