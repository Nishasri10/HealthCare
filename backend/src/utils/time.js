const timeZone = process.env.CLINIC_TIMEZONE || 'Asia/Kolkata';
new Intl.DateTimeFormat('en', { timeZone }).format();

function localDateTimeToUtc(date, time, zone = timeZone) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = (time || '00:00').split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(candidate));
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
    const delta = desired - represented;
    candidate += delta;
    if (delta === 0) return new Date(candidate);
  }
  throw new RangeError(`The requested clinic time does not exist in ${zone}.`);
}

export function clinicDateBoundsToUtc(date) {
  const next = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(next.getTime()) || next.toISOString().slice(0, 10) !== date) {
    throw new RangeError('Invalid clinic date.');
  }
  next.setUTCDate(next.getUTCDate() + 1);
  const endDate = next.toISOString().slice(0, 10);
  return {
    start: localDateTimeToUtc(date, '00:00').toISOString().slice(0, 19).replace('T', ' '),
    end: localDateTimeToUtc(endDate, '00:00').toISOString().slice(0, 19).replace('T', ' ')
  };
}
