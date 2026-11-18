import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Db } from './db.js';
import { panoramica, contenuti, sito, ricercaGoogle, statoRaccolta } from './queries.js';
import { importLinkedin } from './sources/linkedin.js';

const periodo = z.union([
  z.enum(['ultimi_7', 'ultimi_30', 'mese_scorso', 'questo_mese']),
  z.object({ da: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), a: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
]).describe('Periodo: ultimi_7, ultimi_30, mese_scorso, questo_mese oppure { da, a } in formato AAAA-MM-GG');

const json = (x: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(x, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: 'text' as const, text: String((e as any)?.message ?? e) }] });

/** `writable` is used only by importa_linkedin; queries go through `db`. */
export function createServer(db: Db, writable: () => Db = () => db): McpServer {
  const server = new McpServer({ name: 'hub-dati', version: '0.1.0' });

  server.registerTool('panoramica', {
    description: 'Numeri chiave di Instagram, sito (GA4), Google (Search Console) e LinkedIn nel periodo, con confronto e variazione.',
    inputSchema: { periodo, confronto: z.union([z.enum(['precedente', 'anno']), periodo]).default('precedente') },
  }, async ({ periodo: p, confronto }) => { try { return json(panoramica(db, p, confronto)); } catch (e) { return fail(e); } });

  server.registerTool('contenuti', {
    description: 'Post e reel di Instagram, o post di LinkedIn, pubblicati nel periodo, con le metriche, ordinati.',
    inputSchema: {
      canale: z.enum(['instagram', 'linkedin']), periodo,
      ordina_per: z.enum(['copertura', 'visualizzazioni', 'salvataggi', 'interazioni']).default('copertura'),
    },
  }, async ({ canale, periodo: p, ordina_per }) => { try { return json(contenuti(db, canale, p, ordina_per)); } catch (e) { return fail(e); } });

  server.registerTool('sito', {
    description: 'Sessioni, utenti ed eventi chiave del sito (GA4) per canale, sorgente/mezzo o pagina di atterraggio.',
    inputSchema: { periodo, dimensione: z.enum(['canale', 'sorgente', 'pagina']).default('canale') },
  }, async ({ periodo: p, dimensione }) => { try { return json(sito(db, p, dimensione)); } catch (e) { return fail(e); } });

  server.registerTool('ricerca_google', {
    description: 'Clic, impressioni, CTR e posizione su Google (Search Console) per query o per pagina.',
    inputSchema: { periodo, per: z.enum(['query', 'pagina']).default('query'), limite: z.number().int().min(1).max(500).default(50) },
  }, async ({ periodo: p, per, limite }) => { try { return json(ricercaGoogle(db, p, per, limite)); } catch (e) { return fail(e); } });

  server.registerTool('stato_raccolta', {
    description: 'Stato della raccolta per fonte: ultima corsa riuscita, errori, giorni mancanti. Da controllare per primo.',
    inputSchema: {},
  }, async () => { try { return json(statoRaccolta(db)); } catch (e) { return fail(e); } });

  server.registerTool('importa_linkedin', {
    description: "Importa l'export XLSX delle analytics dei contenuti del profilo LinkedIn (percorso assoluto sul Mac).",
    inputSchema: { percorso_file: z.string() },
  }, async ({ percorso_file }) => {
    const w = writable();
    try { return json(await importLinkedin(w, percorso_file)); } catch (e) { return fail(e); } finally { if (w !== db) w.raw.close(); }
  });

  return server;
}
