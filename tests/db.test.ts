import { openDb, missingDays } from '../src/db.js';
test('upsertMetric is idempotent', () => {
  const db = openDb(':memory:');
  db.upsertMetric('ga4', '2026-11-17', 'sessions', 10, { channel: 'Organic' });
  db.upsertMetric('ga4', '2026-11-17', 'sessions', 12, { channel: 'Organic' });
  expect(db.raw.prepare('select count(*) c, max(value) v from metrics').get()).toEqual({ c: 1, v: 12 });
});
test('upsertItem is idempotent and keeps latest fields', () => {
  const db = openDb(':memory:');
  db.upsertItem('instagram', 'm1', '2026-11-12', { reach: 1 });
  db.upsertItem('instagram', 'm1', '2026-11-12', { reach: 2 });
  const r: any = db.raw.prepare('select count(*) c, max(fields_json) f from items').get();
  expect(r.c).toBe(1); expect(JSON.parse(r.f).reach).toBe(2);
});
test('missingDays: first run backfills maxBackfillDays', () => {
  const db = openDb(':memory:');
  expect(missingDays(db, 'gsc', 5, 3, '2026-11-18')).toEqual(
    ['2026-11-13','2026-11-14','2026-11-15','2026-11-16','2026-11-17']);
});
test('missingDays: after 4 days off, recovers gap plus refresh window', () => {
  const db = openDb(':memory:');
  db.recordRun('gsc', '2026-11-12', true);
  expect(missingDays(db, 'gsc', 480, 3, '2026-11-18')).toEqual(
    ['2026-11-10','2026-11-11','2026-11-12','2026-11-13','2026-11-14','2026-11-15','2026-11-16','2026-11-17']);
});
test('lastSuccessDay ignores failures', () => {
  const db = openDb(':memory:');
  db.recordRun('ga4', '2026-11-16', true);
  db.recordRun('ga4', '2026-11-18', false, 'x');
  expect(db.lastSuccessDay('ga4')).toBe('2026-11-16');
  expect(db.lastSuccessDay('gsc')).toBeNull();
});
test('recentFailures counts consecutive failures', () => {
  const db = openDb(':memory:');
  db.recordRun('instagram', '2026-11-16', true);
  db.recordRun('instagram', '2026-11-17', false, 'token');
  db.recordRun('instagram', '2026-11-18', false, 'token');
  expect(db.recentFailures('instagram')).toBe(2);
});
