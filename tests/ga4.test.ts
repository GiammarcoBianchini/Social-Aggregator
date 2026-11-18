import { openDb } from '../src/db.js';
import { ga4 } from '../src/sources/ga4.js';
import { readClient } from '../src/google.js';
import { AuthError } from '../src/sources/types.js';
import { fixtureHttp, fixture } from './helpers.js';
const tok = async () => 'tok';

test('stores sessions by channel', async () => {
  const db = openDb(':memory:');
  await ga4.collectDays(db, ['2026-11-17'], fixtureHttp('ga4-report.json'), tok);
  expect(db.raw.prepare("select value from metrics where source='ga4' and key='sessions' and dims_json=?")
    .get('{"sessionDefaultChannelGroup":"Organic Social"}')).toEqual({ value: 7 });
});
test('runs three reports per day with the property id and bearer token', async () => {
  const http = fixtureHttp('ga4-report.json');
  const seen: RequestInit[] = [];
  const spy = async (u: string, i?: RequestInit) => { seen.push(i!); return http(u, i); };
  await ga4.collectDays(openDb(':memory:'), ['2026-11-17'], spy, tok);
  expect(http.calls).toHaveLength(3);
  expect(http.calls[0]).toContain('properties/516548637:runReport');
  expect((seen[0].headers as any).authorization).toBe('Bearer tok');
  expect(JSON.parse(seen[2].body as string).dimensions).toEqual([{ name: 'landingPage' }]);
});
test('invalid_grant becomes AuthError', async () => {
  await expect(ga4.collectDays(openDb(':memory:'), ['2026-11-17'], fixtureHttp('google-invalid-grant.json', 400), tok))
    .rejects.toBeInstanceOf(AuthError);
});
test('readClient reads installed-app credentials', () => {
  expect(readClient(fixture('client-installed.json'))).toEqual({ clientId: 'abc.apps.googleusercontent.com', clientSecret: 's3cr3t' });
});
