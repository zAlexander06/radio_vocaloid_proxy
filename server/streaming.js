import { Router } from "express";
import http from "node:http";
import { pipeline } from "node:stream";
import dns from "node:dns/promises";
export const streamingRouter = Router();
const stream_url = "http://play.isla.ovh/vocaloplus";
const ip_stream = "64.176.12.57";
const status_json_url = "http://play.isla.ovh/status-json.xsl";
let cachedStatus = null;
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5000;
const cacheCopertine = new Map();
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
const coverCache = new Map();
function hostConsentito(host) {
    const h = host.toLowerCase();
    return COVER_ALLOWED_DOMAINS.some((d) => h === d || h.endsWith("." + d));
}
// Segue i redirect a mano, ricontrollando l'host a ogni passaggio.
async function scaricaCopertina(start) {
    let url = start;
    for (let hop = 0; hop <= 3; hop++) {
        if (url.protocol !== "https:" || !hostConsentito(url.hostname))
            throw new Error("Host non consentito");
        const r = await fetch(url, {
            signal: AbortSignal.timeout(COVER_TIMEOUT_MS),
            redirect: "manual",
            headers: { Accept: "image/*", "User-Agent": "cover-proxy/1.0" },
        });
        if (r.status >= 300 && r.status < 400) {
            const loc = r.headers.get("location");
            if (!loc)
                throw new Error("Redirect senza destinazione");
            url = new URL(loc, url);
            continue;
        }
        return r;
    }
    throw new Error("Troppi redirect");
}
async function leggiConLimite(r, limite) {
    if (!r.body)
        return null;
    const reader = r.body.getReader();
    const chunks = [];
    let totale = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        totale += value.length;
        if (totale > limite) {
            await reader.cancel();
            return null;
        }
        chunks.push(value);
    }
    return Buffer.concat(chunks);
}
function inviaCopertina(res, e) {
    res.setHeader("Content-Type", e.type);
    res.setHeader("Content-Length", e.body.length);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.end(e.body);
}
streamingRouter.get("/cover-proxy", async (req, res) => {
    const raw = req.query.u;
    if (typeof raw !== "string" || raw.length > 2048)
        return res.status(400).send("Parametro 'u' non valido");
    let url;
    try {
        url = new URL(raw);
    }
    catch {
        return res.status(400).send("URL non valido");
    }
    if (url.protocol !== "https:" || !hostConsentito(url.hostname))
        return res.status(403).send("Host non autorizzato");
    const key = url.toString();
    const hit = coverCache.get(key);
    if (hit && hit.expires > Date.now())
        return inviaCopertina(res, hit);
    try {
        const upstream = await scaricaCopertina(url);
        if (!upstream.ok)
            return res.status(502).send(`Errore upstream: ${upstream.status}`);
        const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
        if (!COVER_TYPES.has(type))
            return res.status(415).send("Tipo di file non consentito");
        if (Number(upstream.headers.get("content-length") ?? 0) > COVER_MAX_BYTES) {
            return res.status(413).send("Immagine troppo grande");
        }
        const body = await leggiConLimite(upstream, COVER_MAX_BYTES);
        if (!body)
            return res.status(413).send("Immagine troppo grande");
        const entry = { body, type, expires: Date.now() + COVER_CACHE_TTL_MS };
        if (coverCache.size >= COVER_CACHE_MAX) {
            const oldest = coverCache.keys().next().value;
            if (oldest !== undefined)
                coverCache.delete(oldest);
        }
        coverCache.set(key, entry);
        return inviaCopertina(res, entry);
    }
    catch (err) {
        console.error("cover-proxy:", err.message || err);
        return res.status(502).send("Impossibile scaricare l'immagine");
    }
});
/* Ricerca copertine via API esterne */
async function cercaCopertina(artista, titolo) {
    if (!artista || !titolo || artista.toLowerCase() === "in onda")
        return null;
    const cacheKey = `${artista.toLowerCase()}|${titolo.toLowerCase()}`;
    if (cacheCopertine.has(cacheKey))
        return cacheCopertine.get(cacheKey) ?? null;
    let copertina = null;
    const queryTesto = `${artista} ${titolo}`.trim();
    // Deezer
    try {
        const query = encodeURIComponent(`artist:"${artista}" track:"${titolo}"`);
        const res = await fetch(`https://api.deezer.com/search?q=${query}&limit=1`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            const data = await res.json();
            copertina = data?.data?.[0]?.album?.cover_xl || data?.data?.[0]?.album?.cover_big || null;
        }
    }
    catch {
        console.warn("Deezer fallito, passo a iTunes...");
    }
    // iTunes
    if (!copertina) {
        try {
            const term = encodeURIComponent(queryTesto);
            const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&attribute=songTerm&limit=1`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json();
                const rawUrl = data?.results?.[0]?.artworkUrl100;
                if (rawUrl)
                    copertina = rawUrl.replace("100x100bb", "600x600bb");
            }
        }
        catch {
            console.warn("iTunes fallito, passo a Spotify OEmbed...");
        }
    }
    // Spotify
    if (!copertina) {
        try {
            const term = encodeURIComponent(queryTesto);
            const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/search/${term}`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json();
                copertina = data?.thumbnail_url || null;
            }
        }
        catch {
            console.warn("Spotify OEmbed non ha trovato copertine.");
        }
    }
    // SoundCloud
    if (!copertina) {
        try {
            const term = encodeURIComponent(queryTesto);
            const targetUrl = `https://soundcloud.com/search?q=${term}`;
            const res = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`, { signal: AbortSignal.timeout(3000) });
            if (res.ok) {
                const data = await res.json();
                const rawUrl = data?.thumbnail_url;
                if (rawUrl)
                    copertina = rawUrl.replace("-large.", "-t500x500.");
            }
        }
        catch {
            console.warn("SoundCloud OEmbed non ha trovato copertine.");
        }
    }
    if (cacheCopertine.size >= MAX_SEARCH_CACHE_SIZE) {
        const oldestKey = cacheCopertine.keys().next().value;
        if (oldestKey !== undefined)
            cacheCopertine.delete(oldestKey);
    }
    cacheCopertine.set(cacheKey, copertina);
    return copertina;
}
/* Request helper con gestione risoluzione DNS e Fallback IP per lo Status */
async function fetchConRetry(urlStr, retries = 3, delayMs = 500) {
    let lastError = null;
    const targetUrl = new URL(urlStr);
    const originalHost = targetUrl.hostname;
    let targetIp = ip_stream;
    try {
        const lookup = await dns.lookup(originalHost);
        targetIp = lookup.address;
    }
    catch {
        console.warn(`[Status Fetch] Impossibile risolvere DNS per ${originalHost}, uso IP di fallback:`, targetIp);
    }
    // Ricostruiamo l'URL usando l'IP direttamente per evitare fallimenti fetch DNS
    targetUrl.hostname = targetIp;
    const fetchUrl = targetUrl.toString();
    const headers = {
        "Host": originalHost,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*"
    };
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(fetchUrl, {
                signal: AbortSignal.timeout(5000),
                headers
            });
            if (res.ok)
                return res;
            await res.body?.cancel().catch(() => { });
            lastError = new Error(`Status HTTP ${res.status}`);
        }
        catch (error) {
            lastError = error;
        }
        if (i < retries - 1)
            await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw lastError instanceof Error ? lastError : new Error("Gateway non raggiungibile");
}
/* Endpoint Stream Audio */
streamingRouter.get("/streaming_audio", async (req, res) => {
    const parsedUrl = new URL(stream_url);
    const originalHost = parsedUrl.hostname;
    const path = parsedUrl.pathname + parsedUrl.search;
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 80;
    let targetIp = ip_stream;
    try {
        const lookup = await dns.lookup(originalHost);
        targetIp = lookup.address;
    }
    catch {
        console.warn("[Streaming] Impossibile risolvere DNS, uso IP di fallback:", targetIp);
    }
    const options = {
        hostname: targetIp,
        port: port,
        path: path,
        method: "GET",
        headers: {
            "Host": originalHost,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "*/*",
            "Icy-MetaData": "0",
            "Connection": "close"
        }
    };
    let tentativi = 0;
    const maxTentativi = 2;
    let timerRetry = null;
    function eseguiRichiesta() {
        if (req.destroyed)
            return;
        tentativi++;
        const proxyReq = http.request(options, (streamRes) => {
            if (streamRes.statusCode !== 200) {
                if (tentativi < maxTentativi && !req.destroyed) {
                    timerRetry = setTimeout(eseguiRichiesta, 500);
                    return;
                }
                if (!res.headersSent)
                    res.status(streamRes.statusCode || 502).send("Sorgente radio non pronta");
                return;
            }
            const tipoContenuto = streamRes.headers["content-type"] || "audio/mpeg";
            res.setHeader("Content-Type", tipoContenuto);
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            pipeline(streamRes, res, (err) => {
                if (err && !req.destroyed)
                    console.error("Errore nell'inoltro dello stream audio:", err.message);
                streamRes.destroy();
                proxyReq.destroy();
            });
        });
        proxyReq.on("error", (err) => {
            console.error(`[Tentativo ${tentativi}/${maxTentativi}] Errore Icecast:`, err.code || err.message);
            if (tentativi < maxTentativi && !req.destroyed && !res.headersSent)
                timerRetry = setTimeout(eseguiRichiesta, 1000);
            else if (!res.headersSent)
                res.status(502).send("Errore di connessione allo stream audio");
        });
        proxyReq.setTimeout(8000, () => {
            proxyReq.destroy(new Error("Timeout di connessione con il server Icecast"));
        });
        proxyReq.end();
    }
    req.on("close", () => {
        if (timerRetry)
            clearTimeout(timerRetry);
    });
    eseguiRichiesta();
});
/* Endpoint Status JSON */
streamingRouter.get("/streaming_status", async (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    const now = Date.now();
    if (cachedStatus && now - lastFetchTime < CACHE_DURATION_MS)
        return res.json(cachedStatus);
    try {
        const response = await fetchConRetry(status_json_url, 3, 500);
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        }
        catch {
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
        return res.json(responseData);
    }
    catch (err) {
        console.error("[Status Error]:", err.message || err);
        if (cachedStatus)
            return res.json(cachedStatus);
        return res.status(502).json({ error: "Sorgente status non disponibile", details: err.message || err });
    }
});
//# sourceMappingURL=streaming.js.map