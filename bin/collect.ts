import { openDb } from '../src/db.js';
import { today } from '../src/days.js';
import { withLock } from '../src/lock.js';
import { notify } from '../src/notify.js';
import { runCollection, shouldRun } from '../src/collect.js';
import { instagram } from '../src/sources/instagram.js';
import { ga4 } from '../src/sources/ga4.js';
import { gsc } from '../src/sources/gsc.js';

try {
  const result = await withLock(async () => {
    const db = openDb();
    try {
      const day = today();
      if (!shouldRun(db, day) && !process.argv.includes('--force')) return 'already';
      return await runCollection(db, [instagram, ga4, gsc], day, notify);
    } finally {
      db.raw.close();
    }
  });
  if (result === 'locked') console.log(`${new Date().toISOString()} raccolta già in corso, esco`);
  else if (result === 'already') console.log(`${new Date().toISOString()} raccolta di oggi già completata`);
  else {
    console.log(`${new Date().toISOString()} ${JSON.stringify(result)}`);
    if (Object.values(result).some(r => r && !r.ok)) process.exitCode = 1;
  }
} catch (e: any) {
  console.error(e);
  await notify(`Hub dati: la raccolta non parte (${e?.message ?? e}). Vedi collect.log.`);
  process.exitCode = 1;
}
