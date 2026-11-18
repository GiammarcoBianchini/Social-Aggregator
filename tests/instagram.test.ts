import { openDb } from '../src/db.js';
import { instagram } from '../src/sources/instagram.js';
import { AuthError } from '../src/sources/types.js';
import { fixtureHttp } from './helpers.js';
const tok = async () => 'tok';

test('stores follower and non-follower views per day', async () => {
  const db = openDb(':memory:');
  await instagram.collectDays(db, ['2026-11-17'], fixtureHttp('ig-account-2026-11-17.json'), tok);
  const rows = db.raw.prepare("select dims_json, value from metrics where key='views' and day='2026-11-17' order by dims_json").all();
  expect(rows).toEqual([
    { dims_json: '{"follow_type":"FOLLOWER"}', value: 160 },
    { dims_json: '{"follow_type":"NON_FOLLOWER"}', value: 36 },
  ]);
  expect(db.raw.prepare("select value from metrics where key='accounts_engaged'").get()).toEqual({ value: 4 });
});
test('reel item carries skip rate and avg watch time', async () => {
  const db = openDb(':memory:');
  await instagram.collectDays(db, ['2026-11-12'], fixtureHttp('ig-media.json'), tok);
  const f = JSON.parse((db.raw.prepare("select fields_json from items where item_id='18119684836805248'").get() as any).fields_json);
  expect(f.reach).toBe(302); expect(f.skip_rate).toBe(0.788); expect(f.avg_watch_ms).toBe(4886);
  expect(f.type).toBe('REELS');
  const p: any = db.raw.prepare("select published_day from items where item_id='18101039564542007'").get();
  expect(p.published_day).toBe('2026-11-17'); // 17:30 UTC = 18:30 Rome
});
test('reel insights request uses reel metric names', async () => {
  const http = fixtureHttp('ig-media.json');
  await instagram.collectDays(openDb(':memory:'), ['2026-11-12'], http, tok);
  const reel = http.calls.find(u => u.includes('/18119684836805248/insights'))!;
  expect(reel).toContain('reels_skip_rate'); expect(reel).not.toContain('profile_visits');
});
test('expired token throws AuthError', async () => {
  await expect(instagram.collectDays(openDb(':memory:'), ['2026-11-17'], fixtureHttp('ig-error-190.json', 400), tok))
    .rejects.toBeInstanceOf(AuthError);
});
