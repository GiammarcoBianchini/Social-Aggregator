import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { exchangeMetaToken } from '../src/meta-login.js';
import { setSecret } from '../src/secrets.js';

const rl = createInterface({ input: stdin, output: stdout });
console.log('Serve un token utente (Graph API Explorer) con: instagram_basic, instagram_manage_insights, pages_show_list, pages_read_engagement.\n');
const appId = (await rl.question('ID app Meta: ')).trim();
const appSecret = (await rl.question('Chiave segreta app: ')).trim();
const shortToken = (await rl.question('Token utente di breve durata: ')).trim();
rl.close();

const r = await exchangeMetaToken(fetch, appId, appSecret, shortToken);
if (r.missingScopes.length) {
  console.error(`Permessi mancanti: ${r.missingScopes.join(', ')}. Rigenera il token con questi permessi.`);
  process.exit(1);
}
await setSecret('meta_page_token', r.pageToken);
console.log(`OK: account ${r.username}. Scadenza del token: ${r.neverExpires ? 'nessuna scadenza' : 'ATTENZIONE, il token scade'}.`);
