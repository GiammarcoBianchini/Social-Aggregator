import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type SecretName = 'google_refresh_token' | 'meta_page_token' | 'meta_app_secret';
type Executor = (cmd: string, args: string[]) => Promise<string>;

const SERVICE = 'hub-dati';
const run = promisify(execFile);
let executor: Executor = async (cmd, args) => (await run(cmd, args)).stdout;

/** For tests only. */
export function setExecutor(fn: Executor): void { executor = fn; }

export async function getSecret(name: SecretName): Promise<string | null> {
  try {
    return (await executor('security', ['find-generic-password', '-s', SERVICE, '-a', name, '-w'])).trim();
  } catch (e: any) {
    if (e.code === 44) return null; // errSecItemNotFound
    throw e;
  }
}

export async function setSecret(name: SecretName, value: string): Promise<void> {
  await executor('security', ['add-generic-password', '-U', '-s', SERVICE, '-a', name, '-w', value]);
}
