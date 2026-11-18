import { exchangeMetaToken } from '../src/meta-login.js';
import { fixtureHttp } from './helpers.js';

test('exchanges short token for a non-expiring page token and checks the account', async () => {
  const http = fixtureHttp('meta-exchange.json');
  const r = await exchangeMetaToken(http, 'APPID', 'SECRET', 'SHORT');
  expect(r).toEqual({ pageToken: 'PAGE_TOKEN', username: 'giammarco_bianchini_web', neverExpires: true, missingScopes: [] });
  expect(http.calls[0]).toContain('grant_type=fb_exchange_token');
  expect(http.calls[0]).toContain('fb_exchange_token=SHORT');
  expect(http.calls[1]).toContain('access_token=LONG_USER');
});
