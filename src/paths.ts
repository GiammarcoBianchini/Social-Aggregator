import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export function dataDir(): string {
  const dir = process.env.HUB_DATI_DIR ?? join(homedir(), 'Library', 'Application Support', 'hub-dati');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return join(dataDir(), 'hub.db');
}
