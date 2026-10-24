import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configuredDataDirectory = process.env.DATA_DIR || process.env.DATA_DIRECTORY;
if (configuredDataDirectory && !path.isAbsolute(configuredDataDirectory)) {
  throw new Error('DATA_DIR must be an absolute path to a persistent directory.');
}
const dataDirectory = configuredDataDirectory
  ? path.resolve(configuredDataDirectory)
  : fileURLToPath(new URL('../../data/', import.meta.url));
const collections = ['users', 'doctors', 'specialisations', 'availability', 'appointments', 'medical-records'];
const isId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const schemas = {
  users: (item) => isId(item.id) && typeof item.name === 'string' && typeof item.email === 'string'
    && typeof item.password_hash === 'string' && ['patient', 'doctor', 'admin'].includes(item.role) && typeof item.is_active === 'boolean',
  doctors: (item) => isId(item.id) && isId(item.user_id) && isId(item.specialisation_id)
    && typeof item.qualification === 'string' && Number.isFinite(Number(item.consultation_minutes))
    && (item.consultation_mode === undefined || ['In-person', 'Online', 'Both'].includes(item.consultation_mode))
    && (item.languages === undefined || (Array.isArray(item.languages) && item.languages.every((language) => typeof language === 'string'))),
  specialisations: (item) => isId(item.id) && typeof item.name === 'string',
  availability: (item) => isId(item.id) && isId(item.doctor_id)
    && Number.isFinite(Date.parse(item.starts_at)) && Number.isFinite(Date.parse(item.ends_at))
    && Date.parse(item.ends_at) > Date.parse(item.starts_at),
  appointments: (item) => isId(item.id) && isId(item.patient_id) && isId(item.doctor_id) && isId(item.slot_id)
    && ['booked', 'confirmed', 'completed', 'cancelled', 'declined'].includes(item.status),
  'medical-records': (item) => isId(item.id) && isId(item.appointment_id) && isId(item.patient_id)
    && isId(item.doctor_id) && typeof item.diagnosis === 'string'
};
let writeQueue = Promise.resolve();
let initialization;

async function readCollection(name) {
  const file = path.join(dataDirectory, `${name}.json`);
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(parsed) || parsed.some((entry) => !entry || typeof entry !== 'object'
      || Array.isArray(entry) || !schemas[name](entry))) {
      throw new Error(`Invalid JSON data in ${file}: expected an array of valid ${name} records.`);
    }
    return parsed;
  } catch (error) {
    if (error.code === 'ENOENT') {
      await atomicWrite(file, []);
      return [];
    }
    if (error instanceof SyntaxError) {
      throw new Error(`Cannot read ${file}: malformed JSON. Fix the file; data was not reset.`, { cause: error });
    }
    throw error;
  }
}

async function atomicWrite(file, value) {
  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryFile, file);
  } finally {
    await rm(temporaryFile, { force: true });
  }
}

async function loadData() {
  await mkdir(dataDirectory, { recursive: true });
  const entries = await Promise.all(collections.map(async (name) => [name, await readCollection(name)]));
  return Object.fromEntries(entries);
}

async function ensureInitialized() {
  if (!initialization) initialization = loadData();
  await initialization;
}

export async function readData() {
  await writeQueue;
  await ensureInitialized();
  return loadData();
}

export function updateData(mutator) {
  const operation = writeQueue.then(async () => {
    await ensureInitialized();
    const before = await loadData();
    const state = structuredClone(before);
    const result = await mutator(state);
    const staged = [];
    const committed = [];
    try {
      for (const name of collections) {
        const file = path.join(dataDirectory, `${name}.json`);
        const temporaryFile = `${file}.${randomUUID()}.tmp`;
        staged.push({ name, file, temporaryFile });
        await writeFile(temporaryFile, `${JSON.stringify(state[name], null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
      }
      for (const entry of staged) {
        await rename(entry.temporaryFile, entry.file);
        committed.push(entry);
      }
    } catch (error) {
      const rollbackErrors = [];
      for (const entry of committed) {
        try {
          await atomicWrite(entry.file, before[entry.name]);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (rollbackErrors.length) throw new AggregateError([error, ...rollbackErrors], 'JSON write failed and rollback was incomplete.');
      throw error;
    } finally {
      await Promise.all(staged.map(({ temporaryFile }) => rm(temporaryFile, { force: true })));
    }
    return result;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

export function nextId(items) {
  return items.reduce((largest, item) => Math.max(largest, Number(item.id) || 0), 0) + 1;
}

export function newId() {
  return randomUUID();
}
