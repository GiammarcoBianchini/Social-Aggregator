import { openDb } from '../src/db.js';
import { gsc, GSC_SITE } from '../src/sources/gsc.js';
import { fixtureHttp } from './helpers.js';
const tok = async () => 'tok';

test('stores clicks by query and overwrites on refresh', async () => {
  const db = openDb(':memory:');
  await gsc.collectDays(db, ['2026-11-14'], fixtureHttp('gsc-query-v1.json'), tok);
  await gsc.collectDays(db, ['2026-11-14'], fixtureHttp('gsc-query-v2.json'), tok);
  expect(db.raw.prepare("select value from metrics where source='gsc' and key='clicks' and dims_json=?")
    .get('{"query":"craft cms mantova"}')).toEqual({ value: 3 });
});
test('queries by query and by page for the encoded site', async () => {
  const http = fixtureHttp('gsc-query-v1.json');
  const bodies: any[] = [];
  await gsc.collectDays(openDb(':memory:'), ['2026-11-14'], async (u, i) => { bodies.push(JSON.parse(i!.body as string)); return http(u, i); }, tok);
  expect(http.calls[0]).toContain(`/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`);
  expect(bodies.map(b => b.dimensions)).toEqual([['query'], ['page']]);
  expect(bodies[0]).toMatchObject({ startDate: '2026-11-14', endDate: '2026-11-14', rowLimit: 25000 });
});
