import Database from 'better-sqlite3';
import { dbPath } from './paths.js';
import { addDays, daysBetween } from './days.js';

export type Source = 'instagram' | 'ga4' | 'gsc' | 'gbp' | 'linkedin';

export interface Db {
  upsertMetric(source: Source, day: string, key: string, value: number, dims?: Record<string, string>): void;
  upsertItem(source: Source, itemId: string, publishedDay: string, fields: Record<string, unknown>): void;
  recordRun(source: Source, day: string, ok: boolean, error?: string): void;
  lastSuccessDay(source: Source): string | null;
  recentFailures(source: Source): number;
  raw: Database.Database;
}

const SCHEMA = `
create table if not exists metrics (
  source text not null, day text not null, key text not null, dims_json text not null default '{}',
  value real not null, updated_at text not null default (datetime('now')),
  primary key (source, day, key, dims_json));
create table if not exists items (
  source text not null, item_id text not null, published_day text not null, fields_json text not null,
  updated_at text not null default (datetime('now')),
  primary key (source, item_id));
create table if not exists runs (
  id integer primary key autoincrement, source text not null, day text not null,
  ok integer not null, error text, ran_at text not null default (datetime('now')));
create index if not exists runs_source on runs (source, id);
`;

/** Stable JSON for dims: keys sorted so the same dims always produce the same key. */
function dimsKey(dims?: Record<string, string>): string {
  if (!dims) return '{}';
  return JSON.stringify(Object.fromEntries(Object.entries(dims).sort(([a], [b]) => a.localeCompare(b))));
}

export function openDb(path: string = dbPath(), options: { readonly?: boolean } = {}): Db {
  const raw = new Database(path, { readonly: options.readonly ?? false });
  if (!options.readonly) {
    raw.pragma('journal_mode = WAL');
    raw.exec(SCHEMA);
  }
  const putMetric = options.readonly ? null : raw.prepare(
    `insert into metrics (source, day, key, dims_json, value) values (?, ?, ?, ?, ?)
     on conflict (source, day, key, dims_json) do update set value = excluded.value, updated_at = datetime('now')`);
  const putItem = options.readonly ? null : raw.prepare(
    `insert into items (source, item_id, published_day, fields_json) values (?, ?, ?, ?)
     on conflict (source, item_id) do update set published_day = excluded.published_day,
       fields_json = excluded.fields_json, updated_at = datetime('now')`);
  const putRun = options.readonly ? null : raw.prepare('insert into runs (source, day, ok, error) values (?, ?, ?, ?)');

  return {
    raw,
    upsertMetric(source, day, key, value, dims) { putMetric!.run(source, day, key, dimsKey(dims), value); },
    upsertItem(source, itemId, publishedDay, fields) { putItem!.run(source, itemId, publishedDay, JSON.stringify(fields)); },
    recordRun(source, day, ok, error) { putRun!.run(source, day, ok ? 1 : 0, error ?? null); },
    lastSuccessDay(source) {
      const r = raw.prepare('select max(day) d from runs where source = ? and ok = 1').get(source) as { d: string | null };
      return r.d;
    },
    recentFailures(source) {
      const rows = raw.prepare('select ok from runs where source = ? order by id desc limit 100').all(source) as { ok: number }[];
      let n = 0;
      for (const r of rows) { if (r.ok) break; n++; }
      return n;
    },
  };
}

/**
 * Days to (re)collect for a source, up to the day before `until`:
 * from max(lastSuccess - refreshDays + 1, until - maxBackfillDays); without a success, from until - maxBackfillDays.
 */
export function missingDays(db: Db, source: Source, maxBackfillDays: number, refreshDays: number, until: string): string[] {
  const floor = addDays(until, -maxBackfillDays);
  const last = db.lastSuccessDay(source);
  let from = floor;
  if (last) {
    const fromLast = addDays(last, -refreshDays + 1);
    from = fromLast > floor ? fromLast : floor;
  }
  return daysBetween(from, addDays(until, -1));
}
