const TZ = 'Europe/Rome';

/** Today's date in Europe/Rome, YYYY-MM-DD. */
export function today(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Calendar arithmetic on YYYY-MM-DD strings (UTC noon avoids DST edges). */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of days from `from` to `to`; empty if from > to. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Unix seconds of 00:00 Europe/Rome on `day`. */
export function romeMidnightUnix(day: string): number {
  const utcNoon = new Date(`${day}T12:00:00Z`);
  const romeNoon = new Date(utcNoon.toLocaleString('en-US', { timeZone: TZ }));
  const utcAsLocal = new Date(utcNoon.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offsetMs = romeNoon.getTime() - utcAsLocal.getTime();
  return Math.floor((Date.parse(`${day}T00:00:00Z`) - offsetMs) / 1000);
}

/** The Europe/Rome calendar day of an ISO timestamp. */
export function romeDay(iso: string): string {
  return today(new Date(iso.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')));
}
