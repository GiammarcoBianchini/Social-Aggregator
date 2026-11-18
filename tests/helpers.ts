import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const fixture = (name: string) => join(__dirname, 'fixtures', name);

/**
 * Fake fetch. A JSON fixture is either a single response body (used for every call)
 * or { "routes": { "<url substring>": body, ... } } — first matching substring wins, unmatched → { data: [] }.
 */
export function fixtureHttp(name: string, status = 200) {
  const json = JSON.parse(readFileSync(fixture(name), 'utf8'));
  const calls: string[] = [];
  const http = async (url: string, _init?: RequestInit) => {
    calls.push(url);
    let body: unknown = json;
    if (json && typeof json === 'object' && 'routes' in json) {
      const hit = Object.entries(json.routes as Record<string, unknown>).find(([k]) => url.includes(k));
      body = hit ? hit[1] : { data: [] };
    }
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return Object.assign(http, { calls });
}
