export const clinicTimeZone = import.meta.env.VITE_CLINIC_TIMEZONE || 'Asia/Kolkata';

function parseUtcDate(value) {
  if (value instanceof Date) return value;
  const normalized = typeof value === 'string' && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? `${value}Z` : value;
  return new Date(normalized);
}

export function clinicDateTime(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: clinicTimeZone }).format(parseUtcDate(value));
}

export function clinicDateKey(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: clinicTimeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(parseUtcDate(value));
  const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function clinicTodayKey() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: clinicTimeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function clinicLocalInputToIso(value) {
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: clinicTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    const shown = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
    const delta = desired - shown;
    candidate += delta;
    if (delta === 0) return new Date(candidate).toISOString();
  }
  throw new Error(`That time does not exist in the clinic timezone (${clinicTimeZone}).`);
}
