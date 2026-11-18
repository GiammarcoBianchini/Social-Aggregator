import { getSecret, setSecret, setExecutor } from '../src/secrets.js';
test('getSecret returns null when item not found (exit 44)', async () => {
  setExecutor(async () => { const e: any = new Error('x'); e.code = 44; throw e; });
  expect(await getSecret('meta_page_token')).toBeNull();
});
test('getSecret returns trimmed value', async () => {
  setExecutor(async () => 'tok123\n');
  expect(await getSecret('meta_page_token')).toBe('tok123');
});
test('getSecret rethrows other errors', async () => {
  setExecutor(async () => { const e: any = new Error('denied'); e.code = 51; throw e; });
  await expect(getSecret('meta_page_token')).rejects.toThrow('denied');
});
test('setSecret calls security with -U and service hub-dati', async () => {
  const calls: string[][] = [];
  setExecutor(async (cmd, args) => { calls.push([cmd, ...args]); return ''; });
  await setSecret('google_refresh_token', 'abc');
  expect(calls[0]).toEqual(['security','add-generic-password','-U','-s','hub-dati','-a','google_refresh_token','-w','abc']);
});
