import { openDb, type Source } from '../src/db.js';
import { runCollection } from '../src/collect.js';
import { AuthError, type SourceModule } from '../src/sources/types.js';
import { addDays } from '../src/days.js';

function fakeSource(source: Source, collect: (days: string[]) => Promise<void>, max = 30, refresh = 0): SourceModule & { seen: string[][] } {
  const seen: string[][] = [];
  return { source, maxBackfillDays: max, refreshDays: refresh, seen, async enabled() { return true; },
    async collectDays(_db, days) { seen.push(days); await collect(days); } };
}

test('one failing source does not stop the others', async () => {
  const db = openDb(':memory:');
  const bad = fakeSource('instagram', async () => { throw new AuthError('190'); });
  const good = fakeSource('ga4', async () => {});
  const msgs: string[] = [];
  const s = await runCollection(db, [bad, good], '2026-11-18', async m => { msgs.push(m); });
  expect(s.instagram!.ok).toBe(false); expect(s.ga4!.ok).toBe(true);
  expect(msgs).toHaveLength(1);
  expect(msgs[0]).toMatch(/Instagram/); expect(msgs[0]).toMatch(/login:meta/);
  expect(db.lastSuccessDay('ga4')).toBe('2026-11-17');
});
test('second consecutive generic failure notifies', async () => {
  const db = openDb(':memory:');
  const flaky = fakeSource('gsc', async () => { throw new Error('503'); });
  const msgs: string[] = [];
  await runCollection(db, [flaky], '2026-11-17', async m => { msgs.push(m); });
  expect(msgs).toHaveLength(0);
  await runCollection(db, [flaky], '2026-11-18', async m => { msgs.push(m); });
  expect(msgs).toHaveLength(1); expect(msgs[0]).toMatch(/Search Console/);
});
test('gap beyond backfill window is recorded and notified once', async () => {
  const db = openDb(':memory:');
  db.recordRun('gsc', addDays('2026-11-18', -600), true);
  const src = fakeSource('gsc', async () => {}, 480, 4);
  const msgs: string[] = [];
  await runCollection(db, [src], '2026-11-18', async m => { msgs.push(m); });
  expect(msgs.filter(m => /buco/.test(m))).toHaveLength(1);
  expect(src.seen[0]).toHaveLength(480);
  expect(db.raw.prepare("select count(*) c from runs where error like 'buco:%'").get()).toEqual({ c: 1 });
  await runCollection(db, [src], '2026-11-19', async m => { msgs.push(m); });
  expect(msgs.filter(m => /buco/.test(m))).toHaveLength(1);
});
test('nothing missing means no collectDays call', async () => {
  const db = openDb(':memory:');
  db.recordRun('ga4', '2026-11-17', true);
  const src = fakeSource('ga4', async () => {}, 30, 0);
  const s = await runCollection(db, [src], '2026-11-18', async () => {});
  expect(src.seen).toHaveLength(0); expect(s.ga4).toEqual({ days: 0, ok: true });
});
test('disabled source is skipped', async () => {
  const db = openDb(':memory:');
  const src = { ...fakeSource('gbp', async () => {}), async enabled() { return false; } };
  const s = await runCollection(db, [src], '2026-11-18', async () => {});
  expect(s.gbp).toBeUndefined();
});
