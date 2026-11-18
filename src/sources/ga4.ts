/*
 * GA4 Data API v1beta: POST https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport
 * Body: dateRanges, dimensions, metrics. Rows: dimensionValues[].value, metricValues[].value (strings).
 */
import { googleAccessToken } from '../google.js';
import { getJson, type SourceModule } from './types.js';

export const GA4_PROPERTY = '516548637';
const ENDPOINT = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY}:runReport`;
const METRICS = ['sessions', 'totalUsers', 'keyEvents'];
const REPORTS: string[][] = [['sessionDefaultChannelGroup'], ['sessionSource', 'sessionMedium'], ['landingPage']];

export const ga4: SourceModule = {
  source: 'ga4',
  maxBackfillDays: 425,
  refreshDays: 3,
  async enabled() { return true; },
  async collectDays(db, days, http = fetch, token = googleAccessToken) {
    for (const day of days) {
      const t = await token();
      for (const dims of REPORTS) {
        const body = await getJson(http, ENDPOINT, {
          method: 'POST',
          headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            dateRanges: [{ startDate: day, endDate: day }],
            dimensions: dims.map(name => ({ name })),
            metrics: METRICS.map(name => ({ name })),
            limit: 10000,
          }),
        });
        const metricNames: string[] = (body.metricHeaders ?? []).map((h: any) => h.name);
        for (const row of body.rows ?? []) {
          const d = Object.fromEntries(dims.map((name, i) => [name, row.dimensionValues[i].value]));
          metricNames.forEach((m, i) => db.upsertMetric('ga4', day, m, Number(row.metricValues[i].value), d));
        }
      }
    }
  },
};
