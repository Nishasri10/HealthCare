import test from 'node:test';
import assert from 'node:assert/strict';

process.env.CLINIC_TIMEZONE = 'America/New_York';
const { clinicDateBoundsToUtc } = await import('../src/utils/time.js');

test('clinic calendar dates map to UTC bounds correctly', () => {
  const bounds = clinicDateBoundsToUtc('2026-01-01');
  assert.equal(bounds.start, '2026-01-01 05:00:00');
  assert.equal(bounds.end, '2026-01-02 05:00:00');
});

test('clinic calendar bounds preserve one local day across daylight-saving changes', () => {
  const bounds = clinicDateBoundsToUtc('2026-03-08');
  const hours = (Date.parse(`${bounds.end.replace(' ', 'T')}Z`) - Date.parse(`${bounds.start.replace(' ', 'T')}Z`)) / 3600000;
  assert.equal(hours, 23);
});

test('invalid calendar dates are rejected instead of silently normalized', () => {
  assert.throws(() => clinicDateBoundsToUtc('2026-02-31'), RangeError);
});
