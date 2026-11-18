import { type Db, type Source, missingDays } from './db.js';
import { addDays } from './days.js';
import { AuthError, type SourceModule } from './sources/types.js';

export type RunSummary = Partial<Record<Source, { days: number; ok: boolean; error?: string }>>;

const LABEL: Record<Source, string> = {
  instagram: 'Instagram', ga4: 'GA4', gsc: 'Search Console', gbp: 'Google Business', linkedin: 'LinkedIn',
};
const LOGIN: Partial<Record<Source, string>> = {
  instagram: 'npm run login:meta', ga4: 'npm run login:google', gsc: 'npm run login:google', gbp: 'npm run login:google',
};
const COMPLETE_KEY = 'last_complete_run';

/** False once a run with every source successful has completed on `today` (the job is triggered hourly). */
export function shouldRun(db: Db, today: string): boolean {
  return db.getMeta(COMPLETE_KEY) !== today;
}

export async function runCollection(db: Db, sources: SourceModule[], until: string, notify: (msg: string) => Promise<void>): Promise<RunSummary> {
  const summary: RunSummary = {};
  /** At most one notification per source per day, since failures are retried every hour. */
  const notifyOnce = async (source: Source, msg: string) => {
    const key = `notified:${source}`;
    if (db.getMeta(key) === until) return;
    db.setMeta(key, until);
    await notify(msg);
  };

  for (const src of sources) {
    const name = LABEL[src.source];
    try {
      if (!(await src.enabled())) continue;
    } catch (e: any) {
      const error = String(e?.message ?? e);
      db.recordRun(src.source, until, false, error);
      summary[src.source] = { days: 0, ok: false, error };
      await notifyOnce(src.source, `${name}: impossibile leggere le credenziali (${error}).`);
      continue;
    }

    const last = db.lastSuccessDay(src.source);
    const floor = addDays(until, -src.maxBackfillDays);
    if (last && addDays(last, 1) < floor) {
      const gap = `buco: ${addDays(last, 1)}–${addDays(floor, -1)} non recuperabile`;
      db.recordRun(src.source, until, false, gap);
      await notify(`${name}: ${gap} (il Mac è rimasto spento troppo a lungo).`);
    }

    const days = missingDays(db, src.source, src.maxBackfillDays, src.refreshDays, until);
    if (days.length === 0) { summary[src.source] = { days: 0, ok: true }; continue; }

    try {
      await src.collectDays(db, days);
      for (const d of days) db.recordRun(src.source, d, true);
      summary[src.source] = { days: days.length, ok: true };
    } catch (e: any) {
      const error = String(e?.message ?? e);
      db.recordRun(src.source, until, false, error);
      summary[src.source] = { days: 0, ok: false, error };
      if (e instanceof AuthError) {
        await notifyOnce(src.source, `${name}: accesso non più valido, rifai il login (${LOGIN[src.source] ?? 'login'}).`);
      } else if (db.recentFailures(src.source) >= 2) {
        await notifyOnce(src.source, `${name}: raccolta fallita due volte di fila (${error}).`);
      }
    }
  }
  if (Object.values(summary).every(r => r?.ok)) db.setMeta(COMPLETE_KEY, until);
  return summary;
}
