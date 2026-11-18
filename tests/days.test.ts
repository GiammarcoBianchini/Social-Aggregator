import { daysBetween, addDays } from '../src/days.js';
test('daysBetween crosses DST', () => {
  expect(daysBetween('2026-10-24', '2026-10-26')).toEqual(['2026-10-24','2026-10-25','2026-10-26']);
});
test('addDays crosses month and DST', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-03-29', -1)).toBe('2026-03-28');
});
