import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { nextId, readData, updateData } from '../src/services/jsonStore.js';
import { promptHidden } from '../src/utils/terminal.js';

if (process.env.NODE_ENV === 'production') throw new Error('The local bootstrap command cannot run in production.');

let input = createInterface({ input: stdin, output: stdout });
let confirmationInput;
try {
  const state = await readData();
  if (state.users.some((user) => user.role === 'admin')) throw new Error('An administrator already exists. No account was changed.');
  const name = (await input.question('Administrator name: ')).trim();
  const email = (await input.question('Administrator email: ')).trim().toLowerCase();
  input.close();
  const password = await promptHidden('Administrator password (12-72 characters; input hidden): ');
  confirmationInput = createInterface({ input: stdin, output: stdout });
  const confirmation = await confirmationInput.question('Type CREATE ADMIN to confirm: ');
  if (confirmation !== 'CREATE ADMIN') throw new Error('Confirmation did not match. No account was created.');
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid name and email address.');
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Password must be 12-72 UTF-8 bytes.');
  const hash = await bcrypt.hash(password, 12);
  await updateData((data) => {
    if (data.users.some((user) => user.email === email)) throw new Error('That email address is already registered.');
    if (data.users.some((user) => user.role === 'admin')) throw new Error('An administrator was created by another process.');
    data.users.push({ id: nextId(data.users), name, email, password_hash: hash, role: 'admin', is_active: true, created_at: new Date().toISOString() });
  });
  console.log(`Administrator account created for ${email}.`);
} finally {
  input.close();
  confirmationInput?.close();
}
