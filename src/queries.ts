import type { Db, Source } from './db.js';
import { addDays, daysBetween, today } from './days.js';

export type Periodo = { da: string; a: string } | 'ultimi_7' | 'ultimi_30' | 'mese_scorso' | 'questo_mese';
type Range = { da: string; a: string };
type Valore = { valore: number; confronto: number; variazione: number | null };

export function resolvePeriodo(p: Periodo, oggi: string = today()): Range {
  if (typeof p === 'object') return p;
  const ieri = addDays(oggi, -1);
  switch (p) {
    case 'ultimi_7': return { da: addDays(ieri, -6), a: ieri };
    case 'ultimi_30': return { da: addDays(ieri, -29), a: ieri };
    case 'questo_mese': return { da: `${oggi.slice(0, 7)}-01`, a: ieri < `${oggi.slice(0, 7)}-01` ? `${oggi.slice(0, 7)}-01` : ieri };
    case 'mese_scorso': {
      const fine = addDays(`${oggi.slice(0, 7)}-01`, -1);
      return { da: `${fine.slice(0, 7)}-01`, a: fine };
    }
  }
}

function confrontoRange(r: Range, c: 'precedente' | 'anno' | Periodo, oggi: string): Range {
  if (c === 'precedente') {
    const n = daysBetween(r.da, r.a).length;
    return { da: addDays(r.da, -n), a: addDays(r.da, -1) };
  }
  if (c === 'anno') {
    const shift = (d: string) => `${Number(d.slice(0, 4)) - 1}${d.slice(4)}`;
    return { da: shift(r.da), a: shift(r.a) };
  }
  return resolvePeriodo(c, oggi);
}

const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

function sum(db: Db, source: Source, key: string, r: Range, dimsLike?: string): number {
  const sql = `select coalesce(sum(value), 0) v from metrics where source = ? and key = ? and day between ? and ?`
    + (dimsLike ? ` and dims_json like ?` : '');
  const args: unknown[] = [source, key, r.da, r.a];
  if (dimsLike) args.push(dimsLike);
  return (db.raw.prepare(sql).get(...args) as { v: number }).v;
}

/** Impression-weighted position over rows with the given dims prefix. */
function weightedPosition(db: Db, r: Range, dimsLike: string): number {
  const row = db.raw.prepare(`
    select sum(p.value * i.value) w, sum(i.value) n from metrics p
    join metrics i on i.source = p.source and i.day = p.day and i.dims_json = p.dims_json and i.key = 'impressions'
    where p.source = 'gsc' and p.key = 'position' and p.day between ? and ? and p.dims_json like ?`).get(r.da, r.a, dimsLike) as { w: number | null; n: number | null };
  return row.n ? round(row.w! / row.n, 2) : 0;
}

function snapshot(db: Db, r: Range) {
  const viewsF = sum(db, 'instagram', 'views', r, '%"FOLLOWER"%');
  const viewsN = sum(db, 'instagram', 'views', r, '%"NON_FOLLOWER"%');
  const views = sum(db, 'instagram', 'views', r);
  return {
    instagram: {
      visualizzazioni: views,
      quota_non_follower: views ? round(viewsN / views) : 0,
      copertura_somma_giornaliera: sum(db, 'instagram', 'reach', r),
      tocchi_link_profilo: sum(db, 'instagram', 'profile_links_taps', r),
      follow_netti: sum(db, 'instagram', 'follows_and_unfollows', r, '%"FOLLOWER"%') - sum(db, 'instagram', 'follows_and_unfollows', r, '%"NON_FOLLOWER"%'),
      _follower_views: viewsF,
    },
    sito: {
      sessioni: sum(db, 'ga4', 'sessions', r, '%sessionDefaultChannelGroup%'),
      utenti_somma_giornaliera: sum(db, 'ga4', 'totalUsers', r, '%sessionDefaultChannelGroup%'),
      eventi_chiave: sum(db, 'ga4', 'keyEvents', r, '%sessionDefaultChannelGroup%'),
      sessioni_da_instagram: sum(db, 'ga4', 'sessions', r, '%"sessionSource":"%instagram%'),
      sessioni_da_linkedin: sum(db, 'ga4', 'sessions', r, '%"sessionSource":"%linkedin%'),
    },
    google: {
      clic: sum(db, 'gsc', 'clicks', r, '{"page":%'),
      impressioni: sum(db, 'gsc', 'impressions', r, '{"page":%'),
      posizione_media: weightedPosition(db, r, '{"page":%'),
    },
    linkedin: {
      impressioni: sum(db, 'linkedin', 'impressions', r),
      interazioni: sum(db, 'linkedin', 'engagements', r),
      nuovi_follower: sum(db, 'linkedin', 'new_followers', r),
    },
  };
}

export function panoramica(db: Db, periodo: Periodo, confronto: 'precedente' | 'anno' | Periodo = 'precedente', oggi: string = today()) {
  const r = resolvePeriodo(periodo, oggi);
  const c = confrontoRange(r, confronto, oggi);
  const a = snapshot(db, r), b = snapshot(db, c);
  const out: any = { periodo: r, confronto: c };
  let any = false;
  for (const canale of Object.keys(a) as (keyof typeof a)[]) {
    out[canale] = {};
    for (const [k, v] of Object.entries(a[canale])) {
      if (k.startsWith('_')) continue;
      const cv = (b[canale] as any)[k] as number;
      if (v) any = true;
      out[canale][k] = { valore: v, confronto: cv, variazione: cv ? round((v - cv) / cv) : null } satisfies Valore;
    }
  }
  if (!any) out.nota = `Nessun dato per il periodo ${r.da} – ${r.a}. Controlla stato_raccolta.`;
  return out;
}

const ORDER: Record<string, Record<'instagram' | 'linkedin', (f: any) => number>> = {
  copertura: { instagram: f => f.reach ?? 0, linkedin: f => f.impressions ?? 0 },
  visualizzazioni: { instagram: f => f.views ?? 0, linkedin: f => f.impressions ?? 0 },
  salvataggi: { instagram: f => f.saved ?? 0, linkedin: () => 0 },
  interazioni: {
    instagram: f => (f.likes ?? 0) + (f.comments ?? 0) + (f.saved ?? 0) + (f.shares ?? 0),
    linkedin: f => f.engagements ?? 0,
  },
};

export function contenuti(db: Db, canale: 'instagram' | 'linkedin', periodo: Periodo,
  ordinaPer: 'copertura' | 'visualizzazioni' | 'salvataggi' | 'interazioni' = 'copertura', oggi: string = today()) {
  const r = resolvePeriodo(periodo, oggi);
  const rows = db.raw.prepare(`select item_id, published_day, fields_json from items where source = ? and published_day between ? and ?`)
    .all(canale, r.da, r.a) as { item_id: string; published_day: string; fields_json: string }[];
  const key = ORDER[ordinaPer][canale];
  return rows
    .map(x => {
      const f = JSON.parse(x.fields_json);
      if (typeof f.caption === 'string' && f.caption.length > 120) f.caption = `${f.caption.slice(0, 120)}…`;
      return { id: x.item_id, data: x.published_day, ...f, _k: key(f) };
    })
    .sort((a, b) => b._k - a._k)
    .map(({ _k, ...rest }) => rest);
}

const SITO_DIM = { canale: '%sessionDefaultChannelGroup%', sorgente: '%sessionSource%', pagina: '%landingPage%' } as const;

export function sito(db: Db, periodo: Periodo, dimensione: 'canale' | 'sorgente' | 'pagina' = 'canale', oggi: string = today()) {
  const r = resolvePeriodo(periodo, oggi);
  const rows = db.raw.prepare(`
    select dims_json,
      sum(case when key = 'sessions' then value else 0 end) sessioni,
      sum(case when key = 'totalUsers' then value else 0 end) utenti,
      sum(case when key = 'keyEvents' then value else 0 end) eventi_chiave
    from metrics where source = 'ga4' and day between ? and ? and dims_json like ?
    group by dims_json order by sessioni desc limit 50`).all(r.da, r.a, SITO_DIM[dimensione]) as any[];
  return rows.map(({ dims_json, ...m }) => ({ ...JSON.parse(dims_json), ...m }));
}

export function ricercaGoogle(db: Db, periodo: Periodo, per: 'query' | 'pagina' = 'query', limite = 50, oggi: string = today()) {
  const r = resolvePeriodo(periodo, oggi);
  const like = per === 'query' ? '{"query":%' : '{"page":%';
  const rows = db.raw.prepare(`
    select dims_json,
      sum(case when key = 'clicks' then value else 0 end) clic,
      sum(case when key = 'impressions' then value else 0 end) impressioni
    from metrics where source = 'gsc' and day between ? and ? and dims_json like ?
    group by dims_json order by clic desc, impressioni desc limit ?`).all(r.da, r.a, like, limite) as any[];
  return rows.map(({ dims_json, clic, impressioni }) => {
    const dims = JSON.parse(dims_json);
    const pos = weightedPosition(db, r, dims_json);
    return { ...dims, clic, impressioni, ctr: impressioni ? round(clic / impressioni) : 0, posizione: pos };
  });
}

const SOURCES: Source[] = ['instagram', 'ga4', 'gsc', 'gbp', 'linkedin'];

export function statoRaccolta(db: Db, oggi: string = today()) {
  const out: Record<string, unknown> = {};
  const ieri = addDays(oggi, -1);
  for (const s of SOURCES) {
    const last = db.lastSuccessDay(s);
    const err = db.raw.prepare('select error, ran_at from runs where source = ? and ok = 0 order by id desc limit 1').get(s) as { error: string; ran_at: string } | undefined;
    out[s] = {
      ultima_riuscita: last,
      fallimenti_consecutivi: db.recentFailures(s),
      ultimo_errore: err?.error ?? null,
      giorni_mancanti: last ? Math.max(0, daysBetween(addDays(last, 1), ieri).length) : null,
      ...(s === 'linkedin' ? { nota: 'Import manuale mensile' } : {}),
      ...(s === 'gbp' && !last ? { nota: 'In attesa dell\'accesso alle API di Google Business' } : {}),
    };
  }
  return out as Record<Source, any>;
}
