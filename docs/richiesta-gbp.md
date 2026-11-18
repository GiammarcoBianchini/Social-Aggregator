# Richiesta di accesso alle API di Google Business Profile

Modulo: "GBP API contact form" → "Application for Basic API Access" (support.google.com/business/contact/api_default).
Da inviare con l'account Google proprietario del profilo "Giammarco Bianchini".

| Campo | Risposta |
|---|---|
| Nome azienda | Giammarco Bianchini (ditta individuale) |
| Sito web | https://www.giammarcobianchini.com |
| Email di contatto | {{email dell'account Google proprietario del profilo}} |
| Numero del progetto Google Cloud | {{numero del progetto claude-mcp-512420, dalla dashboard di Google Cloud}} |
| Quante sedi gestisci | 1 |
| Sei il proprietario o gestisci profili per altri | Proprietario del profilo |
| Uso previsto | Lettura delle statistiche di rendimento (Business Profile Performance API) del mio unico profilo, per un report interno mensile. Nessuna modifica ai dati, nessun accesso a profili di terzi. |

Dopo l'approvazione: nel progetto abilita "Business Profile Performance API" e rifai `npm run login:google -- --business`.
