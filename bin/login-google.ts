import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { readClient, GOOGLE_SCOPES } from '../src/google.js';
import { setSecret } from '../src/secrets.js';

const extra = process.argv.includes('--business') ? ['https://www.googleapis.com/auth/business.manage'] : [];
const { clientId, clientSecret } = readClient();

const server = createServer();
await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
const port = (server.address() as { port: number }).port;
const redirectUri = `http://127.0.0.1:${port}`;
const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();

const url = client.generateAuthUrl({
  access_type: 'offline', prompt: 'consent', scope: [...GOOGLE_SCOPES, ...extra],
  code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
});
console.log(`Apro il browser per il consenso Google. Se non si apre:\n${url}\n`);
execFile('open', [url]);

const code = await new Promise<string>((resolve, reject) => {
  server.on('request', (req, res) => {
    const u = new URL(req.url ?? '/', redirectUri);
    const c = u.searchParams.get('code');
    res.end(c ? 'Accesso completato, puoi chiudere questa scheda.' : 'Accesso non completato.');
    server.close();
    c ? resolve(c) : reject(new Error(u.searchParams.get('error') ?? 'nessun codice'));
  });
});

const { tokens } = await client.getToken({ code, codeVerifier });
if (!tokens.refresh_token) throw new Error('Google non ha restituito un refresh token: revoca l\'accesso dell\'app e riprova.');
await setSecret('google_refresh_token', tokens.refresh_token);
client.setCredentials(tokens);

const ga = await client.request<any>({ url: 'https://analyticsadmin.googleapis.com/v1beta/accountSummaries' });
const sc = await client.request<any>({ url: 'https://searchconsole.googleapis.com/webmasters/v3/sites' });
console.log('Proprietà GA4 visibili:');
for (const a of ga.data.accountSummaries ?? []) for (const p of a.propertySummaries ?? []) console.log(`  ${p.property}  ${p.displayName}`);
console.log('Proprietà Search Console visibili:');
for (const s of sc.data.siteEntry ?? []) console.log(`  ${s.siteUrl}  (${s.permissionLevel})`);
console.log('\nSe la proprietà Search Console non è sc-domain:giammarcobianchini.com, imposta HUB_DATI_GSC_SITE (vedi README).');
