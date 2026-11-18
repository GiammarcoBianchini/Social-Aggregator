# Prompt dell'attività pianificata "Riepilogo mensile hub dati"

Primo lunedì del mese, con il Mac acceso (l'attività richiede il computer).

---

Prepara il riepilogo mensile dei canali di Giammarco Bianchini usando gli strumenti MCP `hub-dati`.

1. Chiama `stato_raccolta`. Se una fonte ha errori, giorni mancanti o un buco, scrivilo in cima al riepilogo con l'azione da fare (es. "rifai npm run login:meta"). Se LinkedIn non ha dati del mese scorso, ricorda di esportarli da LinkedIn → Analytics → Contenuti e di importarli con `importa_linkedin`.
2. Chiama `panoramica` con periodo `mese_scorso` e confronto `precedente`.
3. Chiama `contenuti` per `instagram` (ordina per `copertura`, poi per `salvataggi`) e per `linkedin` (per `interazioni`), periodo `mese_scorso`.
4. Chiama `sito` con dimensione `sorgente` e `ricerca_google` per `query`, periodo `mese_scorso`.
5. Leggi dal Project `acquisizione-clienti/instagram-dati-base-novembre.md` (base del 18/11/2026) e l'ultimo riepilogo `acquisizione-clienti/riepilogo-*.md`, se c'è.
6. Scrivi nel Project `acquisizione-clienti/riepilogo-AAAA-MM.md` (mese a cui si riferisce):
   - problemi di raccolta, se ci sono;
   - numeri chiave per canale con variazione sul mese prima e sulla base di novembre;
   - i 3 contenuti migliori e i 3 peggiori con un'ipotesi del perché, legata a un fatto (gancio, formato, argomento);
   - percorso fino al contatto: visualizzazioni → visite al profilo / tocchi sul link → sessioni sul sito da Instagram e LinkedIn → eventi chiave;
   - 3-5 decisioni concrete per il mese (cosa fare di più, cosa smettere, cosa provare), ognuna con il numero che la giustifica.
   Niente numeri inventati: se un dato manca, scrivilo.
7. Manda a Giammarco un messaggio breve con le 3-5 decisioni e il link al documento.
