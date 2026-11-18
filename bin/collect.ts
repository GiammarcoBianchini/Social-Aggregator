import { openDb } from '../src/db.js';
import { today } from '../src/days.js';
import { withLock } from '../src/lock.js';
import { notify } from '../src/notify.js';
import { runCollection } from '../src/collect.js';
import { instagram } from '../src/sources/instagram.js';
import { ga4 } from '../src/sources/ga4.js';
import { gsc } from '../src/sources/gsc.js';

const result = await withLock(async () => {
  const db = openDb();
  try {
    return await runCollection(db, [instagram, ga4, gsc], today(), notify);
  } finally {
    db.raw.close();
  }
});

if (result === 'locked') {
  console.log(`${new Date().toISOString()} raccolta già in corso, esco`);
} else {
  console.log(`${new Date().toISOString()} ${JSON.stringify(result)}`);
  if (Object.values(result).some(r => r && !r.ok)) process.exitCode = 1;
}
