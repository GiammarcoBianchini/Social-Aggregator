import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** macOS notification; never throws. */
export async function notify(msg: string): Promise<void> {
  const safe = msg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  try {
    await run('osascript', ['-e', `display notification "${safe}" with title "Hub dati"`]);
  } catch {
    console.error(`[notifica non inviata] ${msg}`);
  }
}
