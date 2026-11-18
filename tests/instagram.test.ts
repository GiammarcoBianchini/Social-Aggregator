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

test('a metric without a value is skipped, not stored, and posts are still collected', async () => {
  const db = openDb(':memory:');
  const http = async (u: string) => {
    if (u.includes('metric=profile_links_taps') || u.includes('metric=accounts_engaged'))
      return new Response(JSON.stringify({ data: [{ name: 'accounts_engaged', total_value: { value: 3 } }, { name: 'profile_links_taps', total_value: {} }] }));
    if (u.includes('metric=views') || u.includes('metric=reach'))
      return new Response(JSON.stringify({ data: [{ name: 'views', total_value: { value: 5, breakdowns: [{ dimension_keys: ['follow_type'], results: [
        { dimension_values: ['FOLLOWER'], value: 5 }, { dimension_values: ['NON_FOLLOWER'] }] }] } }] }));
    if (u.includes('/media?')) return new Response(JSON.stringify({ data: [{ id: 'p1', media_product_type: 'FEED', timestamp: '2026-11-17T10:00:00+0000' }] }));
    if (u.includes('/p1/insights')) return new Response(JSON.stringify({ data: [{ name: 'reach', values: [{ value: 9 }] }] }));
    return new Response(JSON.stringify({ data: [] }));
  };
  await instagram.collectDays(db, ['2026-11-17'], http, tok);
  expect(db.raw.prepare("select key, value from metrics where key in ('accounts_engaged','profile_links_taps','views') order by key, value").all())
    .toEqual([{ key: 'accounts_engaged', value: 3 }, { key: 'views', value: 5 }]);
  expect((db.raw.prepare('select count(*) c from items').get() as any).c).toBe(1);
});
