import { IG_USER_ID } from './sources/instagram.js';
import { getJson, type Http } from './sources/types.js';

export const PAGE_ID = '114974825841062';
const BASE = 'https://graph.facebook.com/v25.0';
const REQUIRED = ['instagram_basic', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement'];
const q = (p: Record<string, string>) => new URLSearchParams(p).toString();

/** Short-lived user token → long-lived user token → Page token (no expiry when derived from a long-lived token). */
export async function exchangeMetaToken(http: Http, appId: string, appSecret: string, shortToken: string) {
  const long = await getJson(http, `${BASE}/oauth/access_token?${q({
    grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken })}`);
  const page = await getJson(http, `${BASE}/${PAGE_ID}?${q({ fields: 'access_token,instagram_business_account', access_token: long.access_token })}`);
  if (page.instagram_business_account?.id !== IG_USER_ID) {
    throw new Error(`La Pagina ${PAGE_ID} non è collegata all'account Instagram ${IG_USER_ID}`);
  }
  const dbg = await getJson(http, `${BASE}/debug_token?${q({ input_token: page.access_token, access_token: `${appId}|${appSecret}` })}`);
  const ig = await getJson(http, `${BASE}/${IG_USER_ID}?${q({ fields: 'username', access_token: page.access_token })}`);
  const scopes: string[] = dbg.data?.scopes ?? [];
  return {
    pageToken: page.access_token as string,
    username: ig.username as string,
    neverExpires: dbg.data?.expires_at === 0,
    missingScopes: REQUIRED.filter(s => !scopes.includes(s)),
  };
}
