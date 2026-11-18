# Hub dati

Raccoglie ogni giorno sul Mac i dati di Instagram, GA4 e Search Console (poi Google Business) in un file SQLite,
importa gli export di LinkedIn e li espone a Claude con un server MCP locale. Solo lettura, niente su internet.
Progetto: Project "Giammarco Bianchini", `automazioni/hub-dati-design.md`.

## Installazione (una volta)

1. **Google Cloud, progetto `claude-mcp-512420`**
   - API abilitate: Google Analytics Data API, Google Analytics Admin API, Google Search Console API.
   - Schermata di consenso OAuth: se lo stato è "Test", passala a "In produzione" (altrimenti l'accesso scade ogni 7 giorni).
2. `npm ci && npm run build`
3. `npm run login:google` — consenso nel browser; stampa le proprietà GA4 (deve esserci `516548637`) e Search Console.
   Se la proprietà Search Console non è `https://www.giammarcobianchini.com/`, esporta `HUB_DATI_GSC_SITE="<valore stampato>"` prima del passo 6.
4. **Meta**: crea (se non c'è) un'app su developers.facebook.com, tipo Business, modalità sviluppo, con Facebook Login.
   In Graph API Explorer scegli l'app, genera un token utente con `instagram_basic`, `instagram_manage_insights`,
   `pages_show_list`, `pages_read_engagement`.
5. `npm run login:meta` — incolla ID app, chiave segreta e token; deve rispondere `giammarco_bianchini_web` e "nessuna scadenza".
6. `npm run collect` — prima raccolta (recupera fino a 30 giorni di Instagram e 14-16 mesi di GA4 e Search Console).
7. `./scripts/install.sh` — installa la raccolta: parte all'accensione e prova ogni ora finché quella del giorno non è completa e stampa la riga da aggiungere a Claude Desktop.

Le credenziali stanno nel Portachiavi (servizio `hub-dati`), mai nel repository.
Archivio: `~/Library/Application Support/hub-dati/hub.db`.

## Uso

- In Claude: `stato_raccolta`, `panoramica`, `contenuti`, `sito`, `ricerca_google`, `importa_linkedin`.
- LinkedIn, una volta al mese: dal profilo → Analytics → Contenuti → Esporta, poi chiedi a Claude di importare il file
  (`importa_linkedin` con il percorso del file).
- Se arriva una notifica "accesso non più valido": rifai `npm run login:google` o `npm run login:meta`.
- Google Business, quando Google approva l'accesso: `npm run login:google -- --business`.

## Sviluppo

`npm test` (vitest, nessuna chiamata reale alle API).
