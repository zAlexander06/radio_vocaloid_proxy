interface SourceInfo {
    title?: string;
    artist?: string;
    listeners?: number;
    genre?: string;
}

interface streamStatus {
    icestats?: {
        source?: SourceInfo | SourceInfo[];
    };
    metaExt?: {
        artista: string;
        titolo: string;
        copertinaUrl: string | null;
    };
}

interface Brano {
    titolo: string;
    artista: string;
    copertinaUrl: string;
}

const nome_stazione = "Vocaloid Radio";
const copertina_default = "./img/default.jpg";

let playing: boolean = false;
let muted: boolean = false;
let vol: number = 70;
let lastVol: number = 70;

const icone = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
    volumeAlto: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    volumeBasso: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    muto: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>'
};

function svg_dom(): void {
    function creaElementoDaSVG(svgString: string): SVGElement {
        const t = document.createElement("template");
        t.innerHTML = svgString.trim();
        return t.content.firstElementChild as SVGElement;
    }

    const iconeSvg: Record<keyof typeof icone, SVGElement> = Object.fromEntries(
        Object.entries(icone).map(([chiave, svgString]) => [chiave, creaElementoDaSVG(svgString)])
    ) as Record<keyof typeof icone, SVGElement>;

    type metodoInserimento = "append" | "prepend";

    const mappa_icone: [string, SVGElement, metodoInserimento][] = [
        ["#play", iconeSvg.play, "append"],
        ["#mute", iconeSvg.muto, "append"],
    ];

    function inserisciSVGPuro(s: string, svg: SVGElement, m: "append" | "prepend"): void {
        const el = document.querySelector(s);
        if (!el || el.querySelector("svg")) return;
        el[m](svg.cloneNode(true));
    }

    mappa_icone.forEach(([selector, svg, method]) => inserisciSVGPuro(selector, svg, method));
}

let notificaSistemaAbilitata: boolean = true;

function impostaNotificheSistema(attivo: boolean): void {
    notificaSistemaAbilitata = attivo;
    if (!attivo && 'mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

function aggiornaMediaSession(titolo: string, artista: string, copertinaUrl: string, nomeStazione: string = "Player Radio"): void {
    if (!notificaSistemaAbilitata || !('mediaSession' in navigator)) return;

    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: titolo || "In onda",
            artist: artista || "Radio Live",
            album: nomeStazione,
            artwork: [{ src: new URL(copertinaUrl, location.href).href }]
        });
    } catch (e) {
        console.warn("MediaSession Metadata non supportato o errore:", e);
    }
}

function configuraControlliMediaSession(btnPlayPause: HTMLElement): void {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => { btnPlayPause.click(); });
    navigator.mediaSession.setActionHandler("pause", () => { btnPlayPause.click(); });
    navigator.mediaSession.setActionHandler("stop", () => { btnPlayPause.click(); });
}

const canvasColori = document.createElement("canvas");
canvasColori.width = 50;
canvasColori.height = 50;
const ctxColori = canvasColori.getContext("2d", { willReadFrequently: true });

function saturazioneLuminosita(r: number, g: number, b: number): [number, number] {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, l];
    return [d / (1 - Math.abs(2 * l - 1)), l];
}

function estraiPalette(pixels: Uint8ClampedArray): string[] {
    const bucket = new Map<number, { n: number; r: number; g: number; b: number }>();

    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128) continue;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        const e = bucket.get(k);
        if (e) { e.n++; e.r += r; e.g += g; e.b += b; }
        else bucket.set(k, { n: 1, r, g, b });
    }

    const candidati = [...bucket.values()]
        .map((e) => {
            const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n;
            const [s, l] = saturazioneLuminosita(r, g, b);
            return { r, g, b, s, l, score: e.n * (0.2 + s) };
        })
        .filter((c) => c.s > 0.2 && c.l > 0.2 && c.l < 0.75)
        .sort((a, b) => b.score - a.score);

    const scelti: typeof candidati = [];
    for (const c of candidati) {
        if (scelti.every((x) => Math.hypot(x.r - c.r, x.g - c.g, x.b - c.b) > 70)) scelti.push(c);
        if (scelti.length === 3) break;
    }

    return scelti.map((c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`);
}

function applicaColori(img: HTMLImageElement): void {
    if (!ctxColori) return;

    try {
        ctxColori.clearRect(0, 0, 50, 50);
        ctxColori.drawImage(img, 0, 0, 50, 50);
        const palette = estraiPalette(ctxColori.getImageData(0, 0, 50, 50).data);

        if (palette.length === 0) return; // copertina in scala di grigi: tengo i colori precedenti
        while (palette.length < 3) palette.push(palette[palette.length - 1]);

        const stile = document.documentElement.style;
        stile.setProperty("--c1", palette[0]);
        stile.setProperty("--c2", palette[1]);
        stile.setProperty("--c3", palette[2]);
    } catch (error) {
        console.error("Impossibile estrarre i colori dalla copertina:", error);
    }
}

async function caricaImmagine(img: HTMLImageElement, url: string): Promise<boolean> {
    try {
        img.src = url;
        await img.decode();
        return true;
    } catch {
        return false;
    }
}

let ultimoBrano = "";
let versioneBrano = 0;

async function setNowPlaying(brano: Brano): Promise<void> {
    const chiave = `${brano.artista}|${brano.titolo}|${brano.copertinaUrl}`;
    if (chiave === ultimoBrano) return;
    ultimoBrano = chiave;
    const versione = ++versioneBrano;

    const titoloEl = document.getElementById("titolo");
    const artistaEl = document.getElementById("artista");
    const imgEl = document.getElementById("immagine_copertina") as HTMLImageElement | null;

    if (titoloEl) titoloEl.textContent = brano.titolo;
    if (artistaEl) artistaEl.textContent = brano.artista;
    aggiornaMediaSession(brano.titolo, brano.artista, brano.copertinaUrl, nome_stazione);

    if (!imgEl) return;
    imgEl.alt = `Copertina di ${brano.titolo}`;

    let caricata = await caricaImmagine(imgEl, brano.copertinaUrl);
    if (versione !== versioneBrano) return;

    if (!caricata && brano.copertinaUrl !== copertina_default) {
        caricata = await caricaImmagine(imgEl, copertina_default);
        if (versione !== versioneBrano) return;
    }

    if (caricata) applicaColori(imgEl);
}

function draw(): void {
    const playBtn = document.getElementById("play");
    const playerEl = document.getElementById("player");
    const statusEl = document.getElementById("status");

    if (playBtn) {
        playBtn.innerHTML = playing ? icone.pausa : icone.play;
        playBtn.setAttribute("aria-label", playing ? "Pausa" : "Riproduci");
    }

    if (statusEl) statusEl.textContent = playing ? "In diretta" : "In pausa";
    if (playerEl) playerEl.classList.toggle("playing", playing);
}

function setVolume(valVolume: number): void {
    if (valVolume < 0 || valVolume > 100) return;

    const volume = document.getElementById("volume") as HTMLInputElement | null;
    const numVolume = document.getElementById("pct");
    const btnMuto = document.getElementById("mute");
    const playerEl = document.getElementById("player");

    vol = valVolume;
    muted = valVolume === 0;

    if (volume) {
        volume.value = valVolume.toString();
        volume.style.setProperty("--v", (valVolume / 100).toString());
    }

    if (playerEl) playerEl.style.setProperty("--v", (valVolume / 100).toString());
    if (numVolume) numVolume.textContent = valVolume.toString();
    if (btnMuto) btnMuto.innerHTML = (valVolume === 0) ? icone.muto : valVolume < 45 ? icone.volumeBasso : icone.volumeAlto;
}

function togglePlayState(isNowPlaying?: boolean): void {
    playing = isNowPlaying !== undefined ? isNowPlaying : !playing;
    draw();
}

function pulisciTitolo(rawTitle?: string): { artista: string; titolo: string; raw: string } {
    if (!rawTitle || !rawTitle.trim()) return { artista: "Radio Vocaloid", titolo: "In onda", raw: "" };

    const raw = rawTitle.trim();
    const parti = raw.split(" - ");

    if (parti.length >= 2) {
        const artista = parti[0].trim();
        const titolo = parti.slice(1).join(" - ").trim();
        return { artista: artista || "Artista Sconosciuto", titolo: titolo || "Titolo Sconosciuto", raw };
    }

    return { artista: "In onda", titolo: raw, raw };
}

async function fetchStreamStatus(): Promise<void> {
    try {
        const response = await fetch("/streaming_status", { cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw new Error(`Errore HTTP: ${response.status}`);

        const data: streamStatus = await response.json();
        if (!data) return;

        const meta = data.metaExt;

        const src = data.icestats?.source;
        const sourceInfo = Array.isArray(src) ? src[0] : src;
        const infoFallback = pulisciTitolo(sourceInfo?.title);

        await setNowPlaying({
            titolo: meta?.titolo || infoFallback.titolo || "Radio Live",
            artista: meta?.artista || infoFallback.artista || "In onda",
            copertinaUrl: meta?.copertinaUrl || copertina_default,
        });
    } catch (error) {
        console.error("Errore nel recupero dello stato dello stream:", error);
        if (!ultimoBrano) await setNowPlaying({ titolo: "Informazioni non disponibili", artista: "", copertinaUrl: copertina_default });
    }
}

async function appRadio(): Promise<void> {
    svg_dom();

    const audioLiveStream = new Audio();
    const streamUrl = "/streaming_audio";

    const btnPlayPause = document.getElementById("play");
    const tracciaTitolo = document.getElementById("titolo") as HTMLElement | null;
    const tracciaArtista = document.getElementById("artista") as HTMLElement | null;
    const inputVolume = document.getElementById("volume") as HTMLInputElement | null;
    const btnMute = document.getElementById("mute");

    const github_link = document.getElementById("github");

    if (!btnPlayPause || !tracciaTitolo || !tracciaArtista) return;

    audioLiveStream.volume = vol / 100;
    setVolume(vol);
    draw();
    let isLoading = false;

    configuraControlliMediaSession(btnPlayPause);

    btnPlayPause.addEventListener("click", async () => {
        if (isLoading) return;

        if (audioLiveStream.paused) {
            try {
                isLoading = true;

                const haGiaSrcValido = audioLiveStream.src && audioLiveStream.src.includes("/streaming_audio");
                if (!haGiaSrcValido) {
                    audioLiveStream.src = `/streaming_audio?t=${Date.now()}`;
                    audioLiveStream.load();
                }

                await audioLiveStream.play();
                togglePlayState(true);
            } catch (err) {
                console.error("Errore play:", err);
                fermaAudioCompleto();
                togglePlayState(false);
            } finally {
                isLoading = false;
            }
        } else {
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
        inputVolume.addEventListener("input", (e: Event) => {
            const target = e.target as HTMLInputElement;
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
            } else {
                lastVol = vol > 0 ? vol : 70;
                audioLiveStream.volume = 0;
                setVolume(0);
            }
        });
    }

    // github_link?.addEventListener("click", () => {
    //     window.open("")
    // });

    let timerRiconnessione: number | undefined;

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