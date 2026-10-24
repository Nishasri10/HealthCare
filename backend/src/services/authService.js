import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { nextId, readData, updateData } from './jsonStore.js';
import { HttpError } from '../utils/http.js';

export async function registerPatient({ name, email, password }) {
  const hash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.toLowerCase();
  return updateData(({ users }) => {
    if (users.some((user) => user.email === normalizedEmail)) throw new HttpError(409, 'An account with this email already exists.');
    const user = { id: nextId(users), name, email: normalizedEmail, password_hash: hash, role: 'patient', is_active: true, created_at: new Date().toISOString() };
    users.push(user);
    return publicUser(user);
  });
}

export async function login({ email, password }) {
  const { users } = await readData();
  const user = users.find((entry) => entry.email === email.toLowerCase());
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password.');
  }
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  return { token, user: publicUser(user) };
}

export function publicUser(user) {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
