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

export async function runCollection(db: Db, sources: SourceModule[], until: string, notify: (msg: string) => Promise<void>): Promise<RunSummary> {
  const summary: RunSummary = {};
  for (const src of sources) {
    const name = LABEL[src.source];
    try {
      if (!(await src.enabled())) continue;
    } catch (e: any) {
      summary[src.source] = { days: 0, ok: false, error: String(e?.message ?? e) };
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
        await notify(`${name}: accesso non più valido, rifai il login (${LOGIN[src.source] ?? 'login'}).`);
      } else if (db.recentFailures(src.source) >= 2) {
        await notify(`${name}: raccolta fallita due volte di fila (${error}).`);
      }
    }
  }
  return summary;
}
