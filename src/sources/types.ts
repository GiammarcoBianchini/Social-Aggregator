import type { Db, Source } from '../db.js';

export type Http = (url: string, init?: RequestInit) => Promise<Response>;

export class AuthError extends Error {}

export interface SourceModule {
  source: Source;
  /** Maximum days back the API can return. */
  maxBackfillDays: number;
  /** Most recent days re-downloaded on every run. */
  refreshDays: number;
  enabled(): Promise<boolean>;
  /** Throws AuthError when the credential is no longer valid. */
  collectDays(db: Db, days: string[], http?: Http, token?: () => Promise<string>): Promise<void>;
}

/** GET a JSON API; maps auth failures to AuthError. */
export async function getJson(http: Http, url: string, init?: RequestInit): Promise<any> {
  const res = await http(url, init);
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body?.error ?? {};
    const msg = err.message ?? err.error_description ?? body?.error_description ?? `HTTP ${res.status}`;
    // Meta: 190 invalid/expired token, 102 session, 463/467 expired/invalid subcodes. Other OAuthException codes (4, 17, 32, 100…) are not login problems.
    if (res.status === 401 || [190, 102, 463, 467].includes(err.code) || [463, 467].includes(err.error_subcode)
        || body?.error === 'invalid_grant' || err.status === 'UNAUTHENTICATED') {
      throw new AuthError(String(msg));
    }
    throw new Error(String(msg));
  }
  return body;
}
