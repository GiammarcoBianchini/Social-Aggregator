/*
 * Import of the LinkedIn personal content-analytics export (XLSX).
 * Sheets are recognised by their header row, in Italian or English, never by position or name.
 */
import ExcelJS from 'exceljs';
import type { Db } from '../db.js';

type Lang = 'it' | 'en';
const H = {
  date: { it: 'data', en: 'date' },
  impressions: { it: 'impressioni', en: 'impressions' },
  engagements: { it: 'interazioni', en: 'engagements' },
  newFollowers: { it: 'nuovi follower', en: 'new followers' },
  postUrl: { it: 'url del post', en: 'post url' },
  publishDate: { it: 'data di pubblicazione del post', en: 'post publish date' },
};

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

function cellText(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === 'object' && 'result' in v) return (v as any).result;
  if (v && typeof v === 'object' && 'text' in v) return (v as any).text;
  if (v && typeof v === 'object' && 'hyperlink' in v) return (v as any).hyperlink;
  return v;
}

function toDay(v: unknown, lang: Lang): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [a, b, y] = [Number(m[1]), Number(m[2]), m[3]];
  const [mo, d] = lang === 'en' ? [a, b] : [b, a];
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function rows(ws: ExcelJS.Worksheet): unknown[][] {
  const out: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    out[n - 1] = (row.values as ExcelJS.CellValue[]).slice(1).map(cellText);
  });
  return out.map(r => r ?? []);
}

/** Finds a header row containing all labels in one language; returns row index, lang and column indexes. */
function findHeader(data: unknown[][], keys: (keyof typeof H)[]) {
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const cells = data[i].map(norm);
    for (const lang of ['it', 'en'] as Lang[]) {
      const cols = keys.map(k => cells.indexOf(H[k][lang]));
      if (cols.every(c => c >= 0)) return { row: i, lang, cols };
    }
  }
  return null;
}

export async function importLinkedin(db: Db, filePath: string): Promise<{ days: number; posts: number }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const days = new Set<string>();
  const posts = new Map<string, { day: string; fields: Record<string, number> }>();
  let recognised = false;

  for (const ws of wb.worksheets) {
    const data = rows(ws);

    const daily = findHeader(data, ['date', 'impressions', 'engagements']);
    if (daily && !findHeader(data, ['postUrl'])) {
      recognised = true;
      const [cd, ci, ce] = daily.cols;
      for (const r of data.slice(daily.row + 1)) {
        const day = toDay(r[cd], daily.lang);
        if (!day) continue;
        db.upsertMetric('linkedin', day, 'impressions', Number(r[ci] ?? 0));
        db.upsertMetric('linkedin', day, 'engagements', Number(r[ce] ?? 0));
        days.add(day);
      }
    }

    const fol = findHeader(data, ['date', 'newFollowers']);
    if (fol) {
      recognised = true;
      const [cd, cn] = fol.cols;
      for (const r of data.slice(fol.row + 1)) {
        const day = toDay(r[cd], fol.lang);
        if (!day) continue;
        db.upsertMetric('linkedin', day, 'new_followers', Number(r[cn] ?? 0));
        days.add(day);
      }
    }

    const top = findHeader(data, ['postUrl', 'publishDate']);
    if (top) {
      recognised = true;
      const header = data[top.row].map(norm);
      const urlCol = H.postUrl[top.lang];
      // Side-by-side tables: each "post url" column is followed by publish date and one metric.
      header.forEach((h, c) => {
        if (h !== urlCol) return;
        const metricHeader = header[c + 2];
        const metric = metricHeader === H.impressions[top.lang] ? 'impressions' : metricHeader === H.engagements[top.lang] ? 'engagements' : null;
        if (!metric) return;
        for (const r of data.slice(top.row + 1)) {
          const url = String(r[c] ?? '').trim();
          const day = toDay(r[c + 1], top.lang);
          if (!url || !day) continue;
          const p = posts.get(url) ?? { day, fields: {} };
          p.fields[metric] = Number(r[c + 2] ?? 0);
          posts.set(url, p);
        }
      });
    }
  }

  if (!recognised) {
    throw new Error(`Non riconosco questo file come export di LinkedIn. Fogli trovati: ${wb.worksheets.map(w => w.name).join(', ')}`);
  }
  for (const [url, p] of posts) db.upsertItem('linkedin', url, p.day, { ...p.fields, url });
  for (const d of days) db.recordRun('linkedin', d, true);
  return { days: days.size, posts: posts.size };
}
