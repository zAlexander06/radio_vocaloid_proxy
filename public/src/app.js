"use strict";
const nome_stazione = "Vocaloid Radio";
const copertina_default = "./assets/default.jpg";
let playing = false;
let muted = false;
let vol = 70;
let lastVol = 70;
const icone = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    volumeAlto: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    volumeBasso: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    muto: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>',
    github: `<svg viewBox="0 -0.5 25 25"><path d="m12.301 0h.093c2.242 0 4.34.613 6.137 1.68l-.055-.031c1.871 1.094 3.386 2.609 4.449 4.422l.031.058c1.04 1.769 1.654 3.896 1.654 6.166 0 5.406-3.483 10-8.327 11.658l-.087.026c-.063.02-.135.031-.209.031-.162 0-.312-.054-.433-.144l.002.001c-.128-.115-.208-.281-.208-.466 0-.005 0-.01 0-.014v.001q0-.048.008-1.226t.008-2.154c.007-.075.011-.161.011-.249 0-.792-.323-1.508-.844-2.025.618-.061 1.176-.163 1.718-.305l-.076.017c.573-.16 1.073-.373 1.537-.642l-.031.017c.508-.28.938-.636 1.292-1.058l.006-.007c.372-.476.663-1.036.84-1.645l.009-.035c.209-.683.329-1.468.329-2.281 0-.045 0-.091-.001-.136v.007c0-.022.001-.047.001-.072 0-1.248-.482-2.383-1.269-3.23l.003.003c.168-.44.265-.948.265-1.479 0-.649-.145-1.263-.404-1.814l.011.026c-.115-.022-.246-.035-.381-.035-.334 0-.649.078-.929.216l.012-.005c-.568.21-1.054.448-1.512.726l.038-.022-.609.384c-.922-.264-1.981-.416-3.075-.416s-2.153.152-3.157.436l.081-.02q-.256-.176-.681-.433c-.373-.214-.814-.421-1.272-.595l-.066-.022c-.293-.154-.64-.244-1.009-.244-.124 0-.246.01-.364.03l.013-.002c-.248.524-.393 1.139-.393 1.788 0 .531.097 1.04.275 1.509l-.01-.029c-.785.844-1.266 1.979-1.266 3.227 0 .025 0 .051.001.076v-.004c-.001.039-.001.084-.001.13 0 .809.12 1.591.344 2.327l-.015-.057c.189.643.476 1.202.85 1.693l-.009-.013c.354.435.782.793 1.267 1.062l.022.011c.432.252.933.465 1.46.614l.046.011c.466.125 1.024.227 1.595.284l.046.004c-.431.428-.718 1-.784 1.638l-.001.012c-.207.101-.448.183-.699.236l-.021.004c-.256.051-.549.08-.85.08-.022 0-.044 0-.066 0h.003c-.394-.008-.756-.136-1.055-.348l.006.004c-.371-.259-.671-.595-.881-.986l-.007-.015c-.198-.336-.459-.614-.768-.827l-.009-.006c-.225-.169-.49-.301-.776-.38l-.016-.004-.32-.048c-.023-.002-.05-.003-.077-.003-.14 0-.273.028-.394.077l.007-.003q-.128.072-.08.184c.039.086.087.16.145.225l-.001-.001c.061.072.13.135.205.19l.003.002.112.08c.283.148.516.354.693.603l.004.006c.191.237.359.505.494.792l.01.024.16.368c.135.402.38.738.7.981l.005.004c.3.234.662.402 1.057.478l.016.002c.33.064.714.104 1.106.112h.007c.045.002.097.002.15.002.261 0 .517-.021.767-.062l-.027.004.368-.064q0 .609.008 1.418t.008.873v.014c0 .185-.08.351-.208.466h-.001c-.119.089-.268.143-.431.143-.075 0-.147-.011-.214-.032l.005.001c-4.929-1.689-8.409-6.283-8.409-11.69 0-2.268.612-4.393 1.681-6.219l-.032.058c1.094-1.871 2.609-3.386 4.422-4.449l.058-.031c1.739-1.034 3.835-1.645 6.073-1.645h.098-.005zm-7.64 17.666q.048-.112-.112-.192-.16-.048-.208.032-.048.112.112.192.144.096.208-.032zm.497.545q.112-.08-.032-.256-.16-.144-.256-.048-.112.08.032.256.159.157.256.047zm.48.72q.144-.112 0-.304-.128-.208-.272-.096-.144.08 0 .288t.272.112zm.672.673q.128-.128-.064-.304-.192-.192-.32-.048-.144.128.064.304.192.192.32.044zm.913.4q.048-.176-.208-.256-.24-.064-.304.112t.208.24q.24.097.304-.096zm1.009.08q0-.208-.272-.176-.256 0-.256.176 0 .208.272.176.256.001.256-.175zm.929-.16q-.032-.176-.288-.144-.256.048-.224.24t.288.128.225-.224z" /></svg>`
};
function svg_dom() {
    function creaElementoDaSVG(svgString) {
        const t = document.createElement("template");
        t.innerHTML = svgString.trim();
        return t.content.firstElementChild;
    }
    const iconeSvg = Object.fromEntries(Object.entries(icone).map(([chiave, svgString]) => [chiave, creaElementoDaSVG(svgString)]));
    const mappa_icone = [
        ["#play", iconeSvg.play, "append"],
        ["#mute", iconeSvg.muto, "append"],
        ["#github", iconeSvg.github, "append"],
    ];
    function inserisciSVGPuro(s, svg, m) {
        const el = document.querySelector(s);
        if (!el || el.querySelector("svg"))
            return;
        const clone = svg.cloneNode(true);
        if (m === "append")
            el.appendChild(clone);
        else
            el.insertBefore(clone, el.firstChild);
    }
    mappa_icone.forEach(([selector, svg, method]) => inserisciSVGPuro(selector, svg, method));
}
let notificaSistemaAbilitata = true;
function impostaNotificheSistema(attivo) {
    notificaSistemaAbilitata = attivo;
    if (!attivo && 'mediaSession' in navigator)
        navigator.mediaSession.metadata = null;
}
function aggiornaMediaSession(titolo, artista, copertinaUrl, nomeStazione = "Player Radio") {
    if (!notificaSistemaAbilitata || !('mediaSession' in navigator))
        return;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: titolo || "In onda",
            artist: artista || "Radio Live",
            album: nomeStazione,
            artwork: [{ src: new URL(copertinaUrl, location.href).href }]
        });
    }
    catch (e) {
        console.warn("MediaSession Metadata non supportato o errore:", e);
    }
}
function configuraControlliMediaSession(btnPlayPause) {
    if (!('mediaSession' in navigator))
        return;
    navigator.mediaSession.setActionHandler("play", () => { btnPlayPause.click(); });
    navigator.mediaSession.setActionHandler("pause", () => { btnPlayPause.click(); });
    navigator.mediaSession.setActionHandler("stop", () => { btnPlayPause.click(); });
}
const canvasColori = document.createElement("canvas");
canvasColori.width = 50;
canvasColori.height = 50;
const ctxColori = canvasColori.getContext("2d", { willReadFrequently: true });
function saturazioneLuminosita(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0)
        return [0, l];
    return [d / (1 - Math.abs(2 * l - 1)), l];
}
function estraiPalette(pixels) {
    const bucket = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128)
            continue;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const e = bucket.get(k);
        if (e) {
            e.n++;
            e.r += r;
            e.g += g;
            e.b += b;
        }
        else
            bucket.set(k, { n: 1, r, g, b });
    }
    const candidati = [...bucket.values()]
        .map((e) => {
        const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n;
        const [s, l] = saturazioneLuminosita(r, g, b);
        return { r, g, b, s, l, score: e.n * (0.2 + s) };
    })
        .filter((c) => c.s > 0.2 && c.l > 0.2 && c.l < 0.75)
        .sort((a, b) => b.score - a.score);
    const scelti = [];
    for (const c of candidati) {
        if (scelti.every((x) => Math.hypot(x.r - c.r, x.g - c.g, x.b - c.b) > 70))
            scelti.push(c);
        if (scelti.length === 3)
            break;
    }
    return scelti.map((c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`);
}
function applicaColori(img) {
    if (!ctxColori)
        return;
    try {
        ctxColori.clearRect(0, 0, 50, 50);
        ctxColori.drawImage(img, 0, 0, 50, 50);
        const palette = estraiPalette(ctxColori.getImageData(0, 0, 50, 50).data);
        if (palette.length === 0)
            return; // copertina in scala di grigi: tengo i colori precedenti
        while (palette.length < 3)
            palette.push(palette[palette.length - 1]);
        const stile = document.documentElement.style;
        stile.setProperty("--c1", palette[0]);
        stile.setProperty("--c2", palette[1]);
        stile.setProperty("--c3", palette[2]);
    }
    catch (error) {
        console.error("Impossibile estrarre i colori dalla copertina:", error);
    }
}
async function caricaImmagine(img, url) {
    try {
        img.src = url;
        await img.decode();
        return true;
    }
    catch {
        return false;
    }
}
let ultimoBrano = "";
let versioneBrano = 0;
async function setNowPlaying(brano) {
    const chiave = `${brano.artista}|${brano.titolo}|${brano.copertinaUrl}`;
    if (chiave === ultimoBrano)
        return;
    ultimoBrano = chiave;
    const versione = ++versioneBrano;
    const titoloEl = document.getElementById("titolo");
    const artistaEl = document.getElementById("artista");
    const imgEl = document.getElementById("immagine_copertina");
    if (titoloEl)
        titoloEl.textContent = brano.titolo;
    if (artistaEl)
        artistaEl.textContent = brano.artista;
    aggiornaMediaSession(brano.titolo, brano.artista, brano.copertinaUrl, nome_stazione);
    if (!imgEl)
        return;
    imgEl.alt = `Copertina di ${brano.titolo}`;
    let caricata = await caricaImmagine(imgEl, brano.copertinaUrl);
    if (versione !== versioneBrano)
        return;
    if (!caricata && brano.copertinaUrl !== copertina_default) {
        caricata = await caricaImmagine(imgEl, copertina_default);
        if (versione !== versioneBrano)
            return;
    }
    if (caricata)
        applicaColori(imgEl);
}
function draw() {
    const playBtn = document.getElementById("play");
    const playerEl = document.getElementById("player");
    const statusEl = document.getElementById("status");
    if (playBtn) {
        playBtn.innerHTML = playing ? icone.pausa : icone.play;
        playBtn.setAttribute("aria-label", playing ? "Pausa" : "Riproduci");
    }
    if (statusEl)
        statusEl.textContent = playing ? "In diretta" : "In pausa";
    if (playerEl)
        playerEl.classList.toggle("playing", playing);
}
function setVolume(valVolume) {
    if (valVolume < 0 || valVolume > 100)
        return;
    const volume = document.getElementById("volume");
    const numVolume = document.getElementById("pct");
    const btnMuto = document.getElementById("mute");
    const playerEl = document.getElementById("player");
    vol = valVolume;
    muted = valVolume === 0;
    if (volume) {
        volume.value = valVolume.toString();
        volume.style.setProperty("--v", (valVolume / 100).toString());
    }
    if (playerEl)
        playerEl.style.setProperty("--v", (valVolume / 100).toString());
    if (numVolume)
        numVolume.textContent = valVolume.toString();
    if (btnMuto)
        btnMuto.innerHTML = (valVolume === 0) ? icone.muto : valVolume < 45 ? icone.volumeBasso : icone.volumeAlto;
}
function togglePlayState(isNowPlaying) {
    playing = isNowPlaying !== undefined ? isNowPlaying : !playing;
    draw();
}
function pulisciTitolo(rawTitle) {
    if (!rawTitle || !rawTitle.trim())
        return { artista: "Radio Vocaloid", titolo: "In onda", raw: "" };
    const raw = rawTitle.trim();
    const parti = raw.split(" - ");
    if (parti.length >= 2) {
        const artista = parti[0].trim();
        const titolo = parti.slice(1).join(" - ").trim();
        return { artista: artista || "Artista Sconosciuto", titolo: titolo || "Titolo Sconosciuto", raw };
    }
    return { artista: "In onda", titolo: raw, raw };
}
async function fetchStreamStatus() {
    try {
        const response = await fetch("/audio_metadata", { cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            throw new Error(`Errore HTTP: ${response.status}`);
        const data = await response.json();
        if (!data)
            return;
        const meta = data.metaExt;
        const src = data.icestats?.source;
        const sourceInfo = Array.isArray(src) ? src[0] : src;
        const infoFallback = pulisciTitolo(sourceInfo?.title);
        await setNowPlaying({
            titolo: meta?.titolo || infoFallback.titolo || "Radio Live",
            artista: meta?.artista || infoFallback.artista || "In onda",
            copertinaUrl: meta?.copertinaUrl || copertina_default,
        });
    }
    catch (error) {
        console.error("Errore nel recupero dello stato dello stream:", error);
        if (!ultimoBrano)
            await setNowPlaying({ titolo: "Informazioni non disponibili", artista: "", copertinaUrl: copertina_default });
    }
}
async function appRadio() {
    svg_dom();
    const audioLiveStream = new Audio();
    const streamUrl = "/audio";
    const btnPlayPause = document.getElementById("play");
    const tracciaTitolo = document.getElementById("titolo");
    const tracciaArtista = document.getElementById("artista");
    const inputVolume = document.getElementById("volume");
    const btnMute = document.getElementById("mute");
    const github_link = document.getElementById("github");
    if (!btnPlayPause || !tracciaTitolo || !tracciaArtista)
        return;
    audioLiveStream.volume = vol / 100;
    setVolume(vol);
    draw();
    let isLoading = false;
    configuraControlliMediaSession(btnPlayPause);
    btnPlayPause.addEventListener("click", async () => {
        if (isLoading)
            return;
        if (audioLiveStream.paused) {
            try {
                isLoading = true;
                const haGiaSrcValido = audioLiveStream.src && audioLiveStream.src.includes("/audio");
                if (!haGiaSrcValido) {
                    audioLiveStream.src = `/audio?t=${Date.now()}`;
                    audioLiveStream.load();
                }
                await audioLiveStream.play();
                togglePlayState(true);
            }
            catch (err) {
                console.error("Errore play:", err);
                fermaAudioCompleto();
                togglePlayState(false);
            }
            finally {
                isLoading = false;
            }
        }
        else {
            fermaAudioCompleto();
            togglePlayState(false);
        }
    });
    function fermaAudioCompleto() {
        audioLiveStream.pause();
        audioLiveStream.removeAttribute("src");
        audioLiveStream.load();
        clearTimeout(timerRiconnessione);
    }
    if (inputVolume) {
        inputVolume.addEventListener("input", (e) => {
            const target = e.target;
            const value = Number(target.value);
            audioLiveStream.volume = value / 100;
            setVolume(value);
        });
    }
    if (btnMute) {
        btnMute.addEventListener("click", () => {
            if (muted) {
                audioLiveStream.volume = lastVol / 100;
                setVolume(lastVol);
            }
            else {
                lastVol = vol > 0 ? vol : 70;
                audioLiveStream.volume = 0;
                setVolume(0);
            }
        });
    }
    github_link?.addEventListener("click", () => { window.open("https://github.com/zAlexander06/radio_vocaloid_proxy/"); });
    let timerRiconnessione;
    audioLiveStream.addEventListener("error", () => {
        console.warn("Connessione allo stream persa. Tentativo di riconnessione in corso...");
        clearTimeout(timerRiconnessione);
        timerRiconnessione = window.setTimeout(() => {
            if (playing) {
                audioLiveStream.src = `${streamUrl}?t=${Date.now()}`;
                audioLiveStream.load();
                audioLiveStream.play().catch(() => { });
            }
        }, 2000);
    });
    setTimeout(() => {
        fetchStreamStatus();
        setInterval(fetchStreamStatus, 10000);
    }, 1500);
}
document.addEventListener("DOMContentLoaded", appRadio);
//# sourceMappingURL=app.js.map