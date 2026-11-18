# Hub dati marketing — design

Data: 18 novembre 2026 · Stato: da approvare (rivisto dopo la revisione del costruttore)

## Perché
Giammarco (freelance web developer, Mantova) vuole una panoramica unica dei suoi canali (Instagram, LinkedIn, sito, Google Business, Search Console) e, da lì, una strategia chiara. Windsor.ai lo faceva ma a pagamento oltre la prova; lo ha rimosso e vuole una soluzione sua, gratuita.
Chi legge i dati è Claude, non una dashboard: Claude interroga i dati in conversazione (anche dal telefono, attraverso il collegamento dell'app Claude con il Mac) e ogni mese scrive un riepilogo con la strategia nel Project "Giammarco Bianchini".

## Obiettivi
- Raccogliere ogni giorno, senza intervento, i dati di Instagram, GA4 e Search Console; Google Business appena l'API viene concessa.
- Conservare lo storico da oggi in poi, senza buchi anche se il Mac resta spento per giorni.
- Esporre i dati a Claude con un server MCP locale sul Mac.
- Riepilogo mensile: confronto con il mese prima e con la base del 18/11 (documento di Project `acquisizione-clienti/instagram-dati-base-novembre.md`), 3-5 decisioni concrete.

## Non obiettivi
- Nessuna dashboard grafica.
- Facebook escluso.
- Nessuna scrittura verso le piattaforme (niente pubblicazione, niente commenti).
- Nessun dato di account altrui (concorrenti).
- Nessun servizio esposto su internet.

## Anti-obiettivi (fallimento anche se funziona)
- Una manutenzione che lo obbliga a intervenire spesso: token scaduti o raccolta ferma senza che nessuno se ne accorga.
- Costi ricorrenti.
- Credenziali fuori dal Mac o nel repository.

## Vincoli
- Macchina: Mac Apple Silicon di Giammarco. Non sempre acceso. Lì gira già l'app Claude con due MCP locali (analytics-mcp per GA4 via gcloud application-default, mcp-google-search-console), registrati in Claude Desktop; client OAuth Google in `~/.config/claude-mcp/client.json`, progetto Google Cloud `claude-mcp-512420`.
- Codice in un repository suo (GitLab), senza segreti.
- **LinkedIn**: le analytics del profilo personale via API sono riservate a strumenti approvati (Member Post Analytics API): non ottenibili. Si usa l'export manuale mensile delle analytics dei post (XLSX scaricato da LinkedIn), importato con uno strumento MCP. La pagina aziendale LinkedIn resta fuori dalla prima versione.
- **Google Business Profile**: API concessa solo su richiesta (quota 0 fino all'approvazione, attese di settimane). Il modulo lo invia Giammarco (chiede i dati della sua attività) con il progetto Google Cloud `claude-mcp-512420`; Claude prepara il testo. Va inviato subito; la fonte si attiva quando arriva l'approvazione, senza bloccare il resto.
- **Instagram**: account professionale `giammarco_bianchini_web` (id 17841405848018774), collegato alla Pagina Facebook 114974825841062. API ufficiale con app Meta in modalità sviluppo, solo account propri: niente App Review. 
- **GA4**: proprietà 516548637. **Search Console**: proprietà di giammarcobianchini.com. Accesso con le credenziali OAuth già presenti sul Mac (stesso client), scope di sola lettura.

## Approcci considerati
1. **Raccoglitore + SQLite + MCP locale sul Mac** — scelto. Nessun servizio esposto, credenziali solo sul Mac, riusa ciò che c'è, lavoro minimo. Limite accettato: lettura e riepilogo solo a Mac acceso.
2. Cloudflare Workers + D1 + MCP remoto con OAuth — gratuito e sempre raggiungibile, ma servizio esposto e codice legato a Cloudflare; utile solo se servisse leggere a Mac spento.
3. Hetzner (CloudPanel) + SQLite + MCP remoto — come il 2 ma con un server da mantenere e un'autenticazione da costruire.

## Come (deciso)
- Linguaggio: Node.js + TypeScript, SDK MCP ufficiale, trasporto stdio (come gli altri MCP locali). *(scelta di Claude)*
- Archivio: un file SQLite in `~/Library/Application Support/hub-dati/`. *(scelta di Claude)* Backup aggiuntivo rimandato: Giammarco lo decide dopo ("penseremo dopo alle copie"); il file va tenuto in una posizione facile da copiare.
- Segreti: Portachiavi di macOS. *(scelta di Claude)*
- Google (GA4, Search Console, poi Business): login dedicato del raccoglitore con scope di sola lettura, refresh token nel Portachiavi, separato dal login gcloud usato oggi da analytics-mcp. Stesso client OAuth del progetto `claude-mcp-512420`. Primo passo del piano: verificare lo stato di pubblicazione dell'app OAuth; se è in "Test" (refresh token che scadono dopo 7 giorni), passarla "In produzione". *(scelta di Claude)*
- Instagram: accesso tramite Facebook Login sulla Pagina già collegata; si usa un token di Pagina senza scadenza ricavato da un token utente long-lived, quindi nessun rinnovo periodico. Se l'app Meta non esiste ancora, il piano la crea (modalità sviluppo). "Facebook escluso" vale per i dati, non per la Pagina come chiave d'accesso. *(scelta di Claude)*
- Raccolta: agente launchd con orario giornaliero (08:30); launchd esegue la corsa persa al risveglio. Ogni corsa recupera tutti i giorni mancanti dall'ultima riuscita, nei limiti delle API.
- Lettura: server MCP registrato in Claude Desktop, raggiungibile anche dalle sessioni dal telefono quando il Mac è acceso.
- Riepilogo mensile: attività pianificata di Claude il primo lunedì del mese, che richiede il Mac; scrive un documento nel Project.

## Dati raccolti (prima versione)
- **Instagram**: per giorno: visualizzazioni e copertura divise tra follower e non follower, account che interagiscono, tocchi sui link del profilo, follower guadagnati/persi. Per post/reel: data, tipo, didascalia, link, copertura, visualizzazioni, like, commenti, salvataggi, condivisioni, visite al profilo, follow; per i reel anche tasso di salto nei primi 3 secondi e visione media. Le metriche dei post si ri-scaricano ogni giorno per 30 giorni dalla pubblicazione, poi si congelano.
- **GA4**: per giorno: sessioni, utenti, eventi chiave (invio form contatti), per canale e per sorgente/mezzo (con le UTM `instagram` e `linkedin`), per pagina di atterraggio.
- **Search Console**: per giorno: query e pagine con clic, impressioni, CTR, posizione.
- **Google Business** (quando attivo): visualizzazioni del profilo, ricerche, indicazioni, chiamate, clic al sito.
- **LinkedIn profilo personale**: import dell'XLSX mensile (impressioni, interazioni, follower, metriche per post).

## Strumenti MCP (solo lettura, più un import)
- `panoramica(periodo, confronto)`: numeri chiave per canale e variazione rispetto al periodo di confronto.
- `contenuti(canale, periodo, ordina_per)`: post con metriche.
- `sito(periodo, dimensione)`: dati GA4.
- `ricerca_google(periodo, per)`: dati Search Console per query o pagina.
- `stato_raccolta()`: ultima corsa per fonte, errori, scadenza dei token, giorni mancanti.
- `importa_linkedin(percorso_file)`: carica l'export mensile.

## Affidabilità
- Controllo giornaliero di validità dei token (Instagram e Google): se un token smette di funzionare, avviso subito.
- Notifica macOS se una fonte fallisce due corse di fila o se un token non è più valido; lo stesso stato compare in `stato_raccolta` e in cima al riepilogo mensile.
- Se il Mac resta spento più a lungo di quanto un'API permette di recuperare, il buco viene registrato e mostrato, non nascosto.

## Aperto
- Backup aggiuntivo dell'archivio (NAS o altro): da decidere dopo la prima versione.

## Lasciato al costruttore
- Schema delle tabelle SQLite.
- Libreria per l'XLSX di LinkedIn.
- Nomi esatti di endpoint e metriche nelle API (verificare sulla documentazione corrente, non a memoria) e finestre massime di recupero di ciascuna API.
- Struttura del repository e test.
