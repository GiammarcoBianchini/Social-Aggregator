import { openSync, closeSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from './paths.js';

const STALE_MS = 2 * 60 * 60 * 1000;

/** Runs fn only if no other collection holds the lock; returns 'locked' otherwise. */
export async function withLock<T>(fn: () => Promise<T>): Promise<T | 'locked'> {
  const path = join(dataDir(), 'collect.lock');
  let fd: number;
  try {
    fd = openSync(path, 'wx');
  } catch (e: any) {
    if (e.code !== 'EEXIST') throw e;
    try {
      if (Date.now() - statSync(path).mtimeMs > STALE_MS) { unlinkSync(path); return withLock(fn); }
    } catch { /* lock vanished meanwhile */ return withLock(fn); }
    return 'locked';
  }
  try {
    return await fn();
  } finally {
    closeSync(fd);
    try { unlinkSync(path); } catch { /* already gone */ }
  }
}
