import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { OAuth2Client } from 'google-auth-library';
import { getSecret } from './secrets.js';
import { AuthError } from './sources/types.js';

export const CLIENT_PATH = join(homedir(), '.config', 'claude-mcp', 'client.json');
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

export function readClient(path: string = CLIENT_PATH): { clientId: string; clientSecret: string } {
  const j = JSON.parse(readFileSync(path, 'utf8'));
  const c = j.installed ?? j.web;
  if (!c?.client_id) throw new Error(`Client OAuth non valido in ${path}`);
  return { clientId: c.client_id, clientSecret: c.client_secret };
}

let client: OAuth2Client | null = null;

export async function googleAccessToken(): Promise<string> {
  if (!client) {
    const refresh = await getSecret('google_refresh_token');
    if (!refresh) throw new AuthError('Accesso Google mancante: esegui npm run login:google');
    const { clientId, clientSecret } = readClient();
    client = new OAuth2Client({ clientId, clientSecret });
    client.setCredentials({ refresh_token: refresh });
  }
  try {
    const { token } = await client.getAccessToken();
    if (!token) throw new AuthError('Google non ha restituito un token');
    return token;
  } catch (e: any) {
    if (e instanceof AuthError) throw e;
    const reason = e?.response?.data?.error ?? e?.message ?? '';
    if (String(reason).includes('invalid_grant')) throw new AuthError('Accesso Google non più valido: rifai npm run login:google');
    throw e;
  }
}
