import ExcelJS from 'exceljs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.js';
import { importLinkedin } from '../src/sources/linkedin.js';

const dir = mkdtempSync(join(tmpdir(), 'li-'));
const files: Record<string, string> = {};

async function book(name: string, sheets: Record<string, (string | number | Date | null)[][]>) {
  const wb = new ExcelJS.Workbook();
  for (const [s, rows] of Object.entries(sheets)) { const ws = wb.addWorksheet(s); rows.forEach(r => ws.addRow(r)); }
  files[name] = join(dir, name);
  await wb.xlsx.writeFile(files[name]);
}

beforeAll(async () => {
  await book('it.xlsx', {
    'PANORAMICA': [['Impressioni', 1200]],
    'INTERAZIONE': [['Data', 'Impressioni', 'Interazioni'], ['17/11/2026', 300, 12], ['18/11/2026', 250, 9]],
    'POST PRINCIPALI': [
      ['Post principali per interazioni', null, null, null, 'Post principali per impressioni'],
      ['URL del post', 'Data di pubblicazione del post', 'Interazioni', null, 'URL del post', 'Data di pubblicazione del post', 'Impressioni'],
      ['https://www.linkedin.com/feed/update/urn:li:activity:1', '17/11/2026', 10, null, 'https://www.linkedin.com/feed/update/urn:li:activity:1', '17/11/2026', 946],
    ],
    'FOLLOWER': [['Follower totali al 18/11/2026:', 812], [], ['Data', 'Nuovi follower'], ['17/11/2026', 3], ['18/11/2026', 1]],
  });
  await book('en.xlsx', {
    'ENGAGEMENT': [['Date', 'Impressions', 'Engagements'], ['11/17/2026', 300, 12]],
    'TOP POSTS': [['Post URL', 'Post publish date', 'Impressions'], ['https://www.linkedin.com/feed/update/urn:li:activity:2', '11/17/2026', 120]],
  });
  await book('it-text-numbers.xlsx', {
    'INTERAZIONE': [['Data', 'Impressioni', 'Interazioni'], ['17/11/2026', '1.234', '12']],
  });
  await book('it-bad-number.xlsx', {
    'INTERAZIONE': [['Data', 'Impressioni', 'Interazioni'], ['17/11/2026', 'n/d', '12']],
  });
  await book('it-no-dates.xlsx', {
    'INTERAZIONE': [['Data', 'Impressioni', 'Interazioni'], ['2026-11-17', 10, 1]],
  });
  await book('it-eng-only.xlsx', {
    'POST PRINCIPALI': [['URL del post', 'Data di pubblicazione del post', 'Interazioni'], ['https://www.linkedin.com/feed/update/urn:li:activity:1', '17/11/2026', 15]],
  });
  await book('other.xlsx', { 'Foglio1': [['Nome', 'Cognome'], ['Mario', 'Rossi']] });
});

test('imports Italian export and is idempotent', async () => {
  const db = openDb(':memory:');
  const a = await importLinkedin(db, files['it.xlsx']);
  await importLinkedin(db, files['it.xlsx']);
  expect(a).toEqual({ days: 2, posts: 1 });
  expect((db.raw.prepare("select count(*) c from items where source='linkedin'").get() as any).c).toBe(1);
  expect(db.raw.prepare("select value from metrics where source='linkedin' and day='2026-11-17' and key='impressions'").get()).toEqual({ value: 300 });
  expect(db.raw.prepare("select value from metrics where source='linkedin' and day='2026-11-18' and key='new_followers'").get()).toEqual({ value: 1 });
  const f = JSON.parse((db.raw.prepare("select fields_json from items where source='linkedin'").get() as any).fields_json);
  expect(f).toMatchObject({ engagements: 10, impressions: 946 });
  expect(db.lastSuccessDay('linkedin')).toBe('2026-11-18');
});
test('imports English export with US dates', async () => {
  const db = openDb(':memory:');
  expect(await importLinkedin(db, files['en.xlsx'])).toEqual({ days: 1, posts: 1 });
  expect(db.raw.prepare("select value from metrics where source='linkedin' and day='2026-11-17' and key='engagements'").get()).toEqual({ value: 12 });
});
test('unknown workbook gives a clear error', async () => {
  await expect(importLinkedin(openDb(':memory:'), files['other.xlsx'])).rejects.toThrow(/Non riconosco.*Foglio1/);
});

test('F9 Italian thousands separator in text cells', async () => {
  const db = openDb(':memory:');
  await importLinkedin(db, files['it-text-numbers.xlsx']);
  expect(db.raw.prepare("select value from metrics where key='impressions'").get()).toEqual({ value: 1234 });
});
test('F9 unparseable number fails before writing anything', async () => {
  const db = openDb(':memory:');
  await expect(importLinkedin(db, files['it-bad-number.xlsx'])).rejects.toThrow(/non numerico/);
  expect((db.raw.prepare('select count(*) c from metrics').get() as any).c).toBe(0);
});
test('F9 recognised sheet with no readable dates is an error', async () => {
  await expect(importLinkedin(openDb(':memory:'), files['it-no-dates.xlsx'])).rejects.toThrow(/nessuna data/);
});
test('F10 a later export keeps fields it does not contain', async () => {
  const db = openDb(':memory:');
  await importLinkedin(db, files['it.xlsx']);
  await importLinkedin(db, files['it-eng-only.xlsx']);
  const f = JSON.parse((db.raw.prepare("select fields_json from items where source='linkedin'").get() as any).fields_json);
  expect(f).toMatchObject({ engagements: 15, impressions: 946 });
});
