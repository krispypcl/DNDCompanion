/**
 * A sheet's playlist: a YouTube (or YouTube Music) playlist, or one video
 * whose sound plays on loop, read from the link its owner pasted.
 */

export type Playlist = { kind: 'youtube'; list?: string; video?: string };

const YT_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/i;
const ID = /^[\w-]{6,64}$/;

export function parsePlaylist(raw: string | undefined | null): Playlist | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, '');

  if (host === 'youtu.be') {
    const video = url.pathname.slice(1).split('/')[0];
    const list = url.searchParams.get('list') ?? undefined;
    return ID.test(video) ? { kind: 'youtube', video, ...(list && ID.test(list) ? { list } : {}) } : null;
  }
  if (YT_HOSTS.test(host)) {
    const list = url.searchParams.get('list');
    const video = url.searchParams.get('v') ?? url.pathname.match(/\/(?:embed|shorts|live)\/([\w-]+)/)?.[1] ?? null;
    const out: Playlist = { kind: 'youtube' };
    if (list && ID.test(list)) out.list = list;
    if (video && ID.test(video)) out.video = video;
    return out.list || out.video ? out : null;
  }
  return null;
}

// ── Loading the players' scripts, once each ─────────────────────────────────

type YTNamespace = { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
export type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  setVolume(v: number): void;
  mute(): void;
  unMute(): void;
  getPlayerState(): number;
  getVideoData(): { title?: string; author?: string };
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
};

let ytLoading: Promise<YTNamespace> | null = null;
export function loadYouTube(): Promise<YTNamespace> {
  const w = window as unknown as { YT?: YTNamespace & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  ytLoading ??= new Promise((resolve, reject) => {
    const before = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      before?.();
      resolve(w.YT!);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      ytLoading = null;
      reject(new Error('YouTube did not load'));
    };
    document.head.appendChild(s);
  });
  return ytLoading;
}

const VOLUME_KEY = 'dndcompanion:volume';
/** The music's volume, 0 to 100, remembered on this device. */
export function storedVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 70;
  } catch {
    return 70;
  }
}
export function storeVolume(v: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.round(v)));
  } catch {
    /* private mode: it lasts for this visit */
  }
}

/** 83 → "1:23"; 3723 → "1:02:03". */
export function clock(seconds: number): string {
  const t = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
