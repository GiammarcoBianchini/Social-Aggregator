import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { openDb } from '../src/db.js';
import { createServer } from '../src/mcp.js';

async function connect() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([createServer(openDb(':memory:')).connect(a), client.connect(b)]);
  return client;
}
test('mcp lists the six tools', async () => {
  const client = await connect();
  const names = (await client.listTools()).tools.map(t => t.name).sort();
  expect(names).toEqual(['contenuti', 'importa_linkedin', 'panoramica', 'ricerca_google', 'sito', 'stato_raccolta']);
});
test('panoramica tool returns JSON text with a note on empty db', async () => {
  const client = await connect();
  const r: any = await client.callTool({ name: 'panoramica', arguments: { periodo: 'ultimi_30', confronto: 'precedente' } });
  expect(JSON.parse(r.content[0].text).nota).toMatch(/Nessun dato/);
});
test('importa_linkedin reports a readable error for a missing file', async () => {
  const client = await connect();
  const r: any = await client.callTool({ name: 'importa_linkedin', arguments: { percorso_file: '/non/esiste.xlsx' } });
  expect(r.isError).toBe(true);
});
