# Stazione Web Vocaloid

**Disclaimer**: Il vero server dove risiede lo streaming del contenuto non è di mia proprietà.

Il link dove accedere al contenuto reale è questa:
"http://play.isla.ovh/vocaloplus"

---

## Caratteristiche Principali

- **Radio Streaming In tempo Reale:** Riproduzione fluida dei flussi di rete (Icecast/Shoutcast) senza interruzioni.
- **Backend Proxy Intelligente:**
  - Connection pooling e bypass nativo delle latenze DNS tramite IP diretto.
  - Meccanismo di **Retry Automatico** su cadute di connessione o errore `502 Bad Gateway`.
  - Gestione pulita e reattiva delle chiusure dei socket client/server tramite `Node.js Pipeline`.
- **Mini Player & Dashboard Interattiva:** Interfaccia responsive in TypeScript con gestione degli stati di loading, copertine in cache e metadati delle tracce.
- **Gestione Errori Avanzata:** Protezione da rate-limiting lato server remoto e gestione automatica dei timeout di rete.

---

## Tech Stack

### Frontend
- **Framework:** HTML5 / CSS3
- **Linguaggio:** TypeScript

### Backend
- **Runtime:** Node.js
- **Framework Web:** Express
- **Tooling:** `tsx` / TypeScript
- **Moduli Chiave:** `http`, `dns/promises`, `stream/pipeline`

---

## Struttura del Progetto

```text
├── src/
│   ├── client/               # Codice Frontend (TypeScript)
│   │   ├── app.ts            # Gestione della logica del player e UI events
│   │   └── ...
│   └── server/               # Codice Backend (Express / Proxy)
│       └── streaming.ts      # Rotta proxy /streaming_audio e gestione Icecast
├── public/                   # Asset statici (copertine, icone)
├── package.json
└── tsconfig.json