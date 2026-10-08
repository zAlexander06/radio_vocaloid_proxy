import { Hono } from "hono";

export const streamingRouter = new Hono();

const stream_url = "http://play.isla.ovh/vocaloplus";
const status_json_url = "http://play.isla.ovh/status-json.xsl";

let cachedStatus: unknown = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5000;

const cacheCopertine = new Map<string, string | null>();
const MAX_SEARCH_CACHE_SIZE = 500;

const COVER_ALLOWED_DOMAINS = [
    "dzcdn.net",
    "deezer.com",
    "mzstatic.com",
    "scdn.co",
    "spotifycdn.com",
    "spotifycdn.net",
    "sndcdn.com"
];

const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_TIMEOUT_MS = 6000;
const COVER_CACHE_TTL_MS = 60 * 60 * 1000;
const COVER_CACHE_MAX = 100;
const COVER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

type CoverEntry = { body: Uint8Array; type: string; expires: number };
const coverCache = new Map<string, CoverEntry>();

function hostConsentito(host: string): boolean {
    const h = host.toLowerCase();
    return COVER_ALLOWED_DOMAINS.some((d) => h === d || h.endsWith("." + d));
}

// Segue i redirect a mano, ricontrollando l'host a ogni passaggio.
async function scaricaCopertina(start: URL): Promise<globalThis.Response> {
    let url = start;
    for (let hop = 0; hop <= 3; hop++) {
        if (url.protocol !== "https:" || !hostConsentito(url.hostname)) throw new Error("Host non consentito");

        const r = await fetch(url.toString(), {
            signal: AbortSignal.timeout(COVER_TIMEOUT_MS),
            redirect: "manual",
            headers: { Accept: "image/*", "User-Agent": "cover-proxy/1.0" },
        });

        if (r.status >= 300 && r.status < 400) {
            const loc = r.headers.get("location");
            if (!loc) throw new Error("Redirect senza destinazione");
            url = new URL(loc, url);
            continue;
        }
        return r;
    }
    throw new Error("Troppi redirect");
}

async function leggiConLimite(r: globalThis.Response, limite: number): Promise<Uint8Array | null> {
    if (!r.body) return null;
    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    let totale = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totale += value.length;
        if (totale > limite) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }

    const merged = new Uint8Array(totale);
    let offset = 0;
    for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
    }
    return merged;
}

/* Endpoint Proxy Copertine */

streamingRouter.get("/cover-proxy", async (c) => {
    const raw = c.req.query("u");
    if (typeof raw !== "string" || raw.length > 2048) return c.text("Parametro 'u' non valido", 400);

    let url: URL;
    try { url = new URL(raw); } catch { return c.text("URL non valido", 400); }

    if (url.protocol !== "https:" || !hostConsentito(url.hostname)) return c.text("Host non autorizzato", 403);

    const key = url.toString();
    const hit = coverCache.get(key);
    if (hit && hit.expires > Date.now()) {
        const body = new ArrayBuffer(hit.body.byteLength);
        new Uint8Array(body).set(hit.body);
        return new Response(body, {
            headers: {
                "Content-Type": hit.type,
                "Content-Length": hit.body.length.toString(),
                "Cache-Control": "public, max-age=3600",
                "X-Content-Type-Options": "nosniff"
            }
        });
    }

    try {
        const upstream = await scaricaCopertina(url);
        if (!upstream.ok) return c.text(`Errore upstream: ${upstream.status}`, 502);

        const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
        if (!COVER_TYPES.has(type)) return c.text("Tipo di file non consentito", 415);

        if (Number(upstream.headers.get("content-length") ?? 0) > COVER_MAX_BYTES) {
            return c.text("Immagine troppo grande", 413);
        }

        const body = await leggiConLimite(upstream, COVER_MAX_BYTES);
        if (!body) return c.text("Immagine troppo grande", 413);

        const entry: CoverEntry = { body, type, expires: Date.now() + COVER_CACHE_TTL_MS };
        if (coverCache.size >= COVER_CACHE_MAX) {
            const oldest = coverCache.keys().next().value;
            if (oldest !== undefined) coverCache.delete(oldest);
        }
        coverCache.set(key, entry);

        const responseBody = new ArrayBuffer(entry.body.byteLength);
        new Uint8Array(responseBody).set(entry.body);
        return new Response(responseBody, {
            headers: {
                "Content-Type": entry.type,
                "Content-Length": entry.body.length.toString(),
                "Cache-Control": "public, max-age=3600",
                "X-Content-Type-Options": "nosniff"
            }
        });
    } catch (err: any) {
        console.error("cover-proxy:", err.message || err);
        return c.text("Impossibile scaricare l'immagine", 502);
    }
});

/* Ricerca copertine via API esterne */

async function cercaCopertina(artista: string, titolo: string): Promise<string | null> {
    if (!artista || !titolo || artista.toLowerCase() === "in onda") return null;

    const cacheKey = `${artista.toLowerCase()}|${titolo.toLowerCase()}`;
    if (cacheCopertine.has(cacheKey)) return cacheCopertine.get(cacheKey) ?? null;

    let copertina: string | null = null;
    const queryTesto = `${artista} ${titolo}`.trim();

    // Deezer
    try {
        const query = encodeURIComponent(`artist:"${artista}" track:"${titolo}"`);
        const res = await fetch(`https://api.deezer.com/search?q=${query}&limit=1`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            const data: any = await res.json();
            copertina = data?.data?.[0]?.album?.cover_xl || data?.data?.[0]?.album?.cover_big || null;
        }
    } catch { console.warn("Deezer fallito, passo a iTunes..."); }

    // iTunes
    if (!copertina) {
        try {
            const term = encodeURIComponent(queryTesto);
            const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&attribute=songTerm&limit=1`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data: any = await res.json();
                const rawUrl = data?.results?.[0]?.artworkUrl100;
                if (rawUrl) copertina = rawUrl.replace("100x100bb", "600x600bb");
            }
        } catch { console.warn("iTunes fallito, passo a Spotify OEmbed..."); }
    }

    // Spotify
    if (!copertina) {
        try {
            const term = encodeURIComponent(queryTesto);
            const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/search/${term}`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data: any = await res.json();
                copertina = data?.thumbnail_url || null;
            }
        } catch { console.warn("Spotify OEmbed non ha trovato copertine."); }
    }

    // SoundCloud
    if (!copertina) {
        try {
            const term = encodeURIComponent(queryTesto);
            const targetUrl = `https://soundcloud.com/search?q=${term}`;
            const res = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data: any = await res.json();
                const rawUrl = data?.thumbnail_url;
                if (rawUrl) copertina = rawUrl.replace("-large.", "-t500x500.");
            }
        } catch {
            console.warn("SoundCloud OEmbed non ha trovato copertine.");
        }
    }

    if (cacheCopertine.size >= MAX_SEARCH_CACHE_SIZE) {
        const oldestKey = cacheCopertine.keys().next().value;
        if (oldestKey !== undefined) cacheCopertine.delete(oldestKey);
    }

    cacheCopertine.set(cacheKey, copertina);
    return copertina;
}

/* Endpoint Stream Audio (Web ReadableStream nativo) */

streamingRouter.get("/streaming_audio", async (c) => {
    try {
        const response = await fetch(stream_url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Icy-MetaData": "0"
            }
        });

        if (!response.ok || !response.body) {
            return c.text("Sorgente radio non pronta", 502);
        }

        const tipoContenuto = response.headers.get("content-type") || "audio/mpeg";

        return new Response(response.body, {
            status: 200,
            headers: {
                "Content-Type": tipoContenuto,
                "Cache-Control": "no-cache, no-store, must-revalidate",
            }
        });
    } catch (err: any) {
        console.error("[Streaming Error]:", err.message || err);
        return c.text("Errore di connessione allo stream audio", 502);
    }
});

/* Endpoint Status JSON */

streamingRouter.get("/streaming_status", async (c) => {
    const now = Date.now();
    if (cachedStatus && now - lastFetchTime < CACHE_DURATION_MS) {
        return c.json(cachedStatus);
    }

    try {
        const response = await fetch(status_json_url, {
            signal: AbortSignal.timeout(5000),
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*"
            }
        });

        if (!response.ok) {
            throw new Error(`Status HTTP ${response.status}`);
        }

        const text = await response.text();

        let data: any;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error(`Risposta Icecast non valida o non in formato JSON: "${text.substring(0, 80)}..."`);
        }

        const sources = data?.icestats?.source;
        let source = Array.isArray(sources) ? sources[0] : sources;

        let artista = source?.artist || "In onda";
        let titolo = source?.title || "";

        if (!source?.artist && titolo.includes(" - ")) {
            const parti = titolo.split(" - ");
            artista = parti[0].trim();
            titolo = parti.slice(1).join(" - ").trim();
        }

        const copertinaOriginale = await cercaCopertina(artista, titolo);
        const copertinaUrl = copertinaOriginale ? `/cover-proxy?u=${encodeURIComponent(copertinaOriginale)}` : null;
        const responseData = { ...(data || {}), metaExt: { artista, titolo, copertinaUrl } };

        cachedStatus = responseData;
        lastFetchTime = Date.now();

        return c.json(responseData);
    } catch (err: any) {
        console.error("[Status Error]:", err.message || err);
        if (cachedStatus) return c.json(cachedStatus);
        return c.json({ error: "Sorgente status non disponibile", details: err.message || err }, 502);
    }
});