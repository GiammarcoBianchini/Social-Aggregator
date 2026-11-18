/*
 * Instagram via Graph API (Facebook Login, Page token).
 * Verified on developers.facebook.com, 18 Nov 2026:
 * - latest version v25.0
 * - account insights: GET /{ig-user-id}/insights?metric=...&period=day&metric_type=total_value[&breakdown=follow_type]&since&until
 *   views/reach accept breakdown follow_type; follows_and_unfollows accepts follow_type; data only ~30 days back (Facebook Login)
 * - media insights: GET /{media-id}/insights?metric=..., period lifetime, value in data[].values[0].value
 *   FEED: reach, views, saved, shares, likes, comments, profile_visits, follows
 *   REELS: reach, views, saved, shares, likes, comments, ig_reels_avg_watch_time, reels_skip_rate
 */
import type { Db, MetricRow } from '../db.js';
import { addDays, romeDay, romeMidnightUnix } from '../days.js';
import { getSecret } from '../secrets.js';
import { AuthError, getJson, type Http, type SourceModule } from './types.js';

export const IG_USER_ID = '17841405848018774';
const BASE = 'https://graph.facebook.com/v25.0';
const FEED_METRICS = ['reach', 'views', 'saved', 'shares', 'likes', 'comments', 'profile_visits', 'follows'];
const REEL_METRICS = ['reach', 'views', 'saved', 'shares', 'likes', 'comments', 'ig_reels_avg_watch_time', 'reels_skip_rate'];
const FIELD_NAMES: Record<string, string> = { ig_reels_avg_watch_time: 'avg_watch_ms', reels_skip_rate: 'skip_rate' };

async function pageToken(): Promise<string> {
  const t = await getSecret('meta_page_token');
  if (!t) throw new Error('Token Instagram mancante: esegui npm run login:meta');
  return t;
}

function url(path: string, params: Record<string, string | number>): string {
  return `${BASE}${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
}

async function collectAccountDay(db: Db, day: string, http: Http, token: string) {
  const range = { period: 'day', metric_type: 'total_value', since: romeMidnightUnix(day), until: romeMidnightUnix(addDays(day, 1)), access_token: token };
  const rows: MetricRow[] = [];
  const fetchMetric = (metric: string, breakdown?: string) =>
    getJson(http, url(`/${IG_USER_ID}/insights`, { metric, ...range, ...(breakdown ? { breakdown } : {}) }));
  const store = (body: any, breakdown: boolean) => {
    for (const m of body.data ?? []) {
      const tv = m.total_value;
      if (!tv) continue;
      const results = tv.breakdowns?.[0]?.results;
      if (breakdown && results) {
        // Stored under follow_type whatever name Meta used (follow_type / follower_type).
        for (const r of results) {
          if (typeof r.value === 'number') rows.push({ key: m.name, value: r.value, dims: { follow_type: r.dimension_values[0] } });
        }
      } else if (typeof tv.value === 'number') {
        rows.push({ key: m.name, value: tv.value });
      }
    }
  };
  // views and reach separately: the reference lists follow_type for reach and follower_type for views.
  for (const metric of ['views', 'reach']) {
    let body: any = null;
    for (const breakdown of ['follow_type', 'follower_type']) {
      try { body = await fetchMetric(metric, breakdown); break; } catch (e) { if (e instanceof AuthError) throw e; }
    }
    if (body) store(body, true);
    else store(await fetchMetric(metric), false);
  }
  store(await fetchMetric('accounts_engaged,profile_links_taps'), false);
  store(await fetchMetric('follows_and_unfollows', 'follow_type'), true);
  db.replaceDay('instagram', day, rows);
}

async function collectMedia(db: Db, firstDay: string, lastDay: string, http: Http, token: string) {
  const since = romeMidnightUnix(addDays(firstDay, -30));
  const until = romeMidnightUnix(addDays(lastDay, 1));
  let next: string | null = url(`/${IG_USER_ID}/media`, {
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp', since, until, limit: 100, access_token: token });
  while (next) {
    const page: any = await getJson(http, next);
    for (const m of page.data ?? []) {
      const isReel = m.media_product_type === 'REELS';
      const metrics = isReel ? REEL_METRICS : FEED_METRICS;
      let ins: any;
      try {
        ins = await getJson(http, url(`/${m.id}/insights`, { metric: metrics.join(','), access_token: token }));
      } catch (e) {
        if (e instanceof AuthError) throw e;
        console.error(`Instagram: insight non disponibili per il contenuto ${m.id}: ${(e as Error).message}`);
        continue;
      }
      const fields: Record<string, unknown> = {
        type: m.media_product_type, media_type: m.media_type, caption: m.caption ?? '', permalink: m.permalink, timestamp: m.timestamp };
      for (const d of ins.data ?? []) fields[FIELD_NAMES[d.name] ?? d.name] = d.values?.[0]?.value ?? d.total_value?.value ?? null;
      db.upsertItem('instagram', m.id, romeDay(m.timestamp), fields);
    }
    next = page.paging?.next ?? null;
  }
}

export const instagram: SourceModule = {
  source: 'instagram',
  maxBackfillDays: 30,
  refreshDays: 30,
  async enabled() { return (await getSecret('meta_page_token')) !== null; },
  async collectDays(db, days, http = fetch, token = pageToken) {
    if (days.length === 0) return;
    const t = await token();
    for (const day of days) await collectAccountDay(db, day, http, t);
    await collectMedia(db, days[0], days[days.length - 1], http, t);
  },
};
