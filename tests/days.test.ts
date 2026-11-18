import { daysBetween, addDays } from '../src/days.js';
test('daysBetween crosses DST', () => {
  expect(daysBetween('2026-10-24', '2026-10-26')).toEqual(['2026-10-24','2026-10-25','2026-10-26']);
});
test('addDays crosses month and DST', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
});
import { romeMidnightUnix, romeDay } from '../src/days.js';
test('romeMidnightUnix handles CET and CEST', () => {
  expect(romeMidnightUnix('2026-11-17')).toBe(Date.parse('2026-11-16T23:00:00Z') / 1000);
  expect(romeMidnightUnix('2026-07-01')).toBe(Date.parse('2026-06-30T22:00:00Z') / 1000);
});
test('romeDay maps late UTC evening to next Rome day', () => {
  expect(romeDay('2026-11-17T23:30:00+0000')).toBe('2026-11-18');
});
