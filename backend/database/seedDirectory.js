import 'dotenv/config';
import { ensureDemoDirectory } from '../src/services/demoDirectory.js';
import { readData } from '../src/services/jsonStore.js';

if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_SEED !== 'true') {
  throw new Error('Directory seeding is development-only. Set ALLOW_DEMO_SEED=true and NODE_ENV=development before running this command.');
}

const result = await ensureDemoDirectory({ force: true });
const state = await readData();
console.log(`Fictional directory seeded safely: ${state.specialisations.length} specialities, ${state.doctors.length} doctor profiles. ${result.addedDoctors} profiles added this run.`);
