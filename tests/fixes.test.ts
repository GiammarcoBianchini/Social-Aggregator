import { openDb } from '../src/db.js';
import { getJson, AuthError, type SourceModule } from '../src/sources/types.js';
import { ga4 } from '../src/sources/ga4.js';
import { instagram } from '../src/sources/instagram.js';
import { runCollection, shouldRun } from '../src/collect.js';
import { statoRaccolta, ricercaGoogle } from '../src/queries.js';
import { fixtureHttp } from './helpers.js';
const tok = async () => 'tok';
const resp = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

test('F1 refresh replaces a day: rows that disappeared are removed', async () => {
  const db = openDb(':memory:');
  const v1 = { dimensionHeaders: [{ name: 'sessionDefaultChannelGroup' }], metricHeaders: [{ name: 'sessions' }],
    rows: [{ dimensionValues: [{ value: 'Unassigned' }], metricValues: [{ value: '5' }] }] };
  const v2 = { ...v1, rows: [{ dimensionValues: [{ value: 'Organic Search' }], metricValues: [{ value: '5' }] }] };
  await ga4.collectDays(db, ['2026-11-15'], resp(v1), tok);
  await ga4.collectDays(db, ['2026-11-15'], resp(v2), tok);
  expect(db.raw.prepare("select sum(value) s from metrics where source='ga4' and key='sessions'").get()).toEqual({ s: 5 });
});
test('F2 rate limit OAuthException is not an AuthError', async () => {
  const e = await getJson(resp({ error: { type: 'OAuthException', code: 4, message: 'rate' } }, 400), 'u').catch(x => x);
  expect(e).toBeInstanceOf(Error); expect(e).not.toBeInstanceOf(AuthError);
  const a = await getJson(resp({ error: { type: 'OAuthException', code: 190, message: 'exp' } }, 400), 'u').catch(x => x);
  expect(a).toBeInstanceOf(AuthError);
});
test('F3 views falls back to follower_type when follow_type is rejected', async () => {
  const db = openDb(':memory:');
  const http = async (u: string) => {
    if (u.includes('metric=views') && u.includes('breakdown=follow_type'))
      return new Response(JSON.stringify({ error: { type: 'OAuthException', code: 100, message: 'Invalid breakdown' } }), { status: 400 });
    if (u.includes('metric=views') && u.includes('breakdown=follower_type'))
      return new Response(JSON.stringify({ data: [{ name: 'views', total_value: { value: 10, breakdowns: [{ dimension_keys: ['follower_type'], results: [
        { dimension_values: ['FOLLOWER'], value: 7 }, { dimension_values: ['NON_FOLLOWER'], value: 3 }] }] } }] }));
    return new Response(JSON.stringify({ data: [] }));
  };
  await instagram.collectDays(db, ['2026-11-17'], http, tok);
  expect(db.raw.prepare("select value from metrics where key='views' and dims_json=?").get('{"follow_type":"NON_FOLLOWER"}')).toEqual({ value: 3 });
});
test('F4 one failing media insights call does not stop the others', async () => {
  const db = openDb(':memory:');
  const http = async (u: string) => {
    if (u.includes('/media?')) return new Response(JSON.stringify({ data: [
      { id: 'bad', media_product_type: 'FEED', timestamp: '2026-11-10T10:00:00+0000' },
      { id: 'good', media_product_type: 'FEED', timestamp: '2026-11-11T10:00:00+0000' }] }));
    if (u.includes('/bad/insights')) return new Response(JSON.stringify({ error: { code: 100, message: 'unsupported' } }), { status: 400 });
    if (u.includes('/good/insights')) return new Response(JSON.stringify({ data: [{ name: 'reach', values: [{ value: 9 }] }] }));
    return new Response(JSON.stringify({ data: [] }));
  };
  await instagram.collectDays(db, ['2026-11-17'], http, tok);
  expect((db.raw.prepare("select count(*) c from items").get() as any).c).toBe(1);
});
test('F5 shouldRun is false once every source succeeded today', async () => {
  const db = openDb(':memory:');
  const src: SourceModule = { source: 'ga4', maxBackfillDays: 30, refreshDays: 1, async enabled() { return true; }, async collectDays() {} };
  expect(shouldRun(db, '2026-11-18')).toBe(true);
  await runCollection(db, [src], '2026-11-18', async () => {});
  expect(shouldRun(db, '2026-11-18')).toBe(false);
  expect(shouldRun(db, '2026-11-19')).toBe(true);
});
test('F5 hourly retries notify an auth problem once per day', async () => {
  const db = openDb(':memory:');
  const bad: SourceModule = { source: 'instagram', maxBackfillDays: 30, refreshDays: 1, async enabled() { return true; },
    async collectDays() { throw new AuthError('190'); } };
  const msgs: string[] = [];
  await runCollection(db, [bad], '2026-11-18', async m => { msgs.push(m); });
  await runCollection(db, [bad], '2026-11-18', async m => { msgs.push(m); });
  expect(msgs).toHaveLength(1);
});
test('F6 enabled() throwing is recorded and notified', async () => {
  const db = openDb(':memory:');
  const src: SourceModule = { source: 'instagram', maxBackfillDays: 30, refreshDays: 1,
    async enabled() { throw new Error('keychain locked'); }, async collectDays() {} };
  const msgs: string[] = [];
  await runCollection(db, [src], '2026-11-18', async m => { msgs.push(m); });
  expect(db.recentFailures('instagram')).toBe(1);
  expect(msgs[0]).toMatch(/keychain locked/);
});
test('F7 gaps stay visible in stato_raccolta', () => {
  const db = openDb(':memory:');
  db.recordRun('gsc', '2026-11-01', false, 'buco: 2025-01-01–2025-07-01 non recuperabile');
  db.recordRun('gsc', '2026-11-17', true);
  db.recordRun('gsc', '2026-11-18', false, 'rete');
  expect(statoRaccolta(db, '2026-11-19').gsc.buchi).toEqual(['2025-01-01–2025-07-01']);
});
test('F8 position for a page with % or _ in the URL uses only that page', () => {
  const db = openDb(':memory:');
  for (const [page, pos, imp] of [['/a_b', 3, 10], ['/axb', 20, 1000]] as const) {
    db.upsertMetric('gsc', '2026-11-15', 'clicks', 1, { page });
    db.upsertMetric('gsc', '2026-11-15', 'impressions', imp, { page });
    db.upsertMetric('gsc', '2026-11-15', 'position', pos, { page });
  }
  const r = ricercaGoogle(db, { da: '2026-11-01', a: '2026-11-30' }, 'pagina');
  expect(r.find((x: any) => x.page === '/a_b').posizione).toBe(3);
});
