import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { updateData } from '../src/services/jsonStore.js';

const confirmationText = 'DELETE ALL LOCAL HEALTHCARE DATA';
if (process.env.NODE_ENV === 'production') throw new Error('The local reset command cannot run in production.');

const input = createInterface({ input: stdin, output: stdout });
try {
  const confirmation = await input.question(`This removes all local accounts, appointments, availability, and records. Type "${confirmationText}" to continue: `);
  if (confirmation !== confirmationText) throw new Error('Confirmation did not match. No data was changed.');
  await updateData((state) => {
    for (const key of Object.keys(state)) state[key] = [];
  });
  console.log('Local JSON data has been reset.');
} finally {
  input.close();
}
