import { openDb } from '../src/db.js';
import { panoramica, contenuti, sito, ricercaGoogle, statoRaccolta, resolvePeriodo } from '../src/queries.js';

function seededDb() {
  const db = openDb(':memory:');
  db.upsertMetric('instagram', '2026-10-15', 'views', 300, { follow_type: 'FOLLOWER' });
  db.upsertMetric('instagram', '2026-10-15', 'views', 100, { follow_type: 'NON_FOLLOWER' });
  db.upsertMetric('instagram', '2026-11-15', 'views', 200, { follow_type: 'FOLLOWER' });
  db.upsertMetric('instagram', '2026-11-15', 'views', 200, { follow_type: 'NON_FOLLOWER' });
  db.upsertMetric('instagram', '2026-11-15', 'follows_and_unfollows', 5, { follow_type: 'FOLLOWER' });
  db.upsertMetric('instagram', '2026-11-15', 'follows_and_unfollows', 2, { follow_type: 'NON_FOLLOWER' });
  db.upsertMetric('ga4', '2026-11-15', 'sessions', 10, { sessionDefaultChannelGroup: 'Direct' });
  db.upsertMetric('ga4', '2026-11-15', 'sessions', 4, { sessionMedium: 'social', sessionSource: 'instagram' });
  db.upsertMetric('ga4', '2026-11-15', 'sessions', 3, { sessionMedium: 'social', sessionSource: 'linkedin.com' });
  db.upsertMetric('gsc', '2026-11-15', 'clicks', 2, { page: '/a' });
  db.upsertMetric('gsc', '2026-11-15', 'impressions', 100, { page: '/a' });
  db.upsertMetric('gsc', '2026-11-15', 'position', 4, { page: '/a' });
  db.upsertMetric('gsc', '2026-11-15', 'clicks', 0, { page: '/b' });
  db.upsertMetric('gsc', '2026-11-15', 'impressions', 300, { page: '/b' });
  db.upsertMetric('gsc', '2026-11-15', 'position', 12, { page: '/b' });
  db.upsertMetric('gsc', '2026-11-15', 'clicks', 2, { query: 'craft cms' });
  db.upsertMetric('gsc', '2026-11-15', 'impressions', 50, { query: 'craft cms' });
  db.upsertMetric('gsc', '2026-11-15', 'position', 3, { query: 'craft cms' });
  db.upsertItem('instagram', 'r1', '2026-11-12', { type: 'REELS', caption: 'Ping', reach: 302, views: 494, saved: 0, likes: 14, comments: 0, shares: 1 });
  db.upsertItem('instagram', 'c1', '2026-11-17', { type: 'FEED', caption: 'Preventivi', reach: 33, views: 88, saved: 2, likes: 4, comments: 0, shares: 0 });
  return db;
}
const NOV = { da: '2026-11-01', a: '2026-11-30' };

test('panoramica computes non-follower share and delta', () => {
  const p = panoramica(seededDb(), NOV, 'precedente');
  expect(p.instagram.quota_non_follower).toEqual({ valore: 0.5, confronto: 0.25, variazione: 1 });
  expect(p.instagram.follow_netti.valore).toBe(3);
  expect(p.sito.sessioni_da_instagram.valore).toBe(4);
  expect(p.sito.sessioni_da_linkedin.valore).toBe(3);
});
test('panoramica google position is impression-weighted from page rows', () => {
  const p = panoramica(seededDb(), NOV, 'precedente');
  expect(p.google.clic.valore).toBe(2);
  expect(p.google.posizione_media.valore).toBe(10); // (4*100 + 12*300) / 400
});
test('empty period returns zeros and a note, not an error', () => {
  const p = panoramica(openDb(':memory:'), 'ultimi_7', 'precedente');
  expect(p.nota).toMatch(/Nessun dato/);
  expect(p.instagram.visualizzazioni.valore).toBe(0);
});
test('resolvePeriodo: mese_scorso and ultimi_7 end yesterday', () => {
  expect(resolvePeriodo('mese_scorso', '2026-12-01')).toEqual({ da: '2026-11-01', a: '2026-11-30' });
  expect(resolvePeriodo('ultimi_7', '2026-11-18')).toEqual({ da: '2026-11-11', a: '2026-11-17' });
});
test('contenuti sorts by chosen metric', () => {
  const c = contenuti(seededDb(), 'instagram', NOV, 'salvataggi');
  expect(c.map(x => x.id)).toEqual(['c1', 'r1']);
  expect(contenuti(seededDb(), 'instagram', NOV, 'copertura')[0].id).toBe('r1');
});
test('sito groups by source and ricercaGoogle by query', () => {
  expect(sito(seededDb(), NOV, 'sorgente')[0]).toMatchObject({ sessionSource: 'instagram', sessioni: 4 });
  expect(ricercaGoogle(seededDb(), NOV, 'query')[0]).toMatchObject({ query: 'craft cms', clic: 2, impressioni: 50, ctr: 0.04 });
});
test('stato_raccolta lists missing days up to yesterday', () => {
  const db = openDb(':memory:');
  db.recordRun('ga4', '2026-11-15', true);
  db.recordRun('ga4', '2026-11-18', false, 'rete');
  const s = statoRaccolta(db, '2026-11-18');
  expect(s.ga4).toMatchObject({ ultima_riuscita: '2026-11-15', fallimenti_consecutivi: 1, ultimo_errore: 'rete', giorni_mancanti: 2 });
});
