import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withLock } from '../src/lock.js';
beforeEach(() => { process.env.HUB_DATI_DIR = mkdtempSync(join(tmpdir(), 'hub-')); });
test('second concurrent call returns locked', async () => {
  const slow = withLock(() => new Promise(r => setTimeout(() => r('a'), 50)));
  expect(await withLock(async () => 'b')).toBe('locked');
  expect(await slow).toBe('a');
});
test('lock is released after completion, even on error', async () => {
  await expect(withLock(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
  expect(await withLock(async () => 'ok')).toBe('ok');
});
