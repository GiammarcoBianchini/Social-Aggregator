/*
 * Search Console API: POST https://searchconsole.googleapis.com/webmasters/v3/sites/{site}/searchAnalytics/query
 * Body: startDate, endDate, dimensions, rowLimit (max 25000), dataState. Rows: keys[], clicks, impressions, ctr, position.
 * Data is kept 16 months and arrives with ~2-3 days of delay.
 */
import type { MetricRow } from '../db.js';
import { googleAccessToken } from '../google.js';
import { getJson, type SourceModule } from './types.js';

/** Confirm the exact property form at first login (domain vs URL-prefix property). */
export const GSC_SITE = process.env.HUB_DATI_GSC_SITE ?? 'https://www.giammarcobianchini.com/';
const ENDPOINT = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`;
const METRICS = ['clicks', 'impressions', 'ctr', 'position'] as const;

export const gsc: SourceModule = {
  source: 'gsc',
  maxBackfillDays: 480,
  refreshDays: 4,
  async enabled() { return true; },
  async collectDays(db, days, http = fetch, token = googleAccessToken) {
    for (const day of days) {
      const t = await token();
      const rows: MetricRow[] = [];
      for (const dim of ['query', 'page'] as const) {
        const body = await getJson(http, ENDPOINT, {
          method: 'POST',
          headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
          body: JSON.stringify({ startDate: day, endDate: day, dimensions: [dim], rowLimit: 25000, dataState: 'all' }),
        });
        for (const row of body.rows ?? []) {
          for (const m of METRICS) rows.push({ key: m, value: row[m], dims: { [dim]: row.keys[0] } });
        }
      }
      db.replaceDay('gsc', day, rows);
    }
  },
};
