/**
 * A sheet's playlist: a YouTube (or YouTube Music) playlist or video, or a
 * Spotify playlist, album or track, read from the link its owner pasted.
 */

export type Playlist =
  | { kind: 'youtube'; list?: string; video?: string }
  | { kind: 'spotify'; type: string; id: string };

const YT_HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com)$/i;
const ID = /^[\w-]{6,64}$/;

export function parsePlaylist(raw: string | undefined | null): Playlist | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  // spotify:playlist:37i9dQZF1DXcBWIGoYBM5M
  const uri = text.match(/^spotify:(playlist|album|track|artist|show|episode):([A-Za-z0-9]+)$/);
  if (uri) return { kind: 'spotify', type: uri[1], id: uri[2] };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, '');

  if (host === 'open.spotify.com' || host === 'play.spotify.com') {
    // /playlist/ID, or /intl-de/playlist/ID
    const m = url.pathname.match(/\/(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/);
    return m ? { kind: 'spotify', type: m[1], id: m[2] } : null;
  }

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

export type SpotifyController = {
  togglePlay(): void;
  resume(): void;
  pause(): void;
  destroy(): void;
  addListener(event: string, fn: (e: { data: { isPaused: boolean; isBuffering?: boolean } }) => void): void;
};
type SpotifyApi = {
  createController(el: HTMLElement, opts: unknown, cb: (c: SpotifyController) => void): void;
};

let spLoading: Promise<SpotifyApi> | null = null;
export function loadSpotify(): Promise<SpotifyApi> {
  const w = window as unknown as { onSpotifyIframeApiReady?: (api: SpotifyApi) => void };
  spLoading ??= new Promise((resolve, reject) => {
    w.onSpotifyIframeApiReady = (api) => resolve(api);
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    s.onerror = () => {
      spLoading = null;
      reject(new Error('Spotify did not load'));
    };
    document.head.appendChild(s);
  });
  return spLoading;
}

export const VOLUME_KEY = 'dndcompanion:volume';
export function storedVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && localStorage.getItem(VOLUME_KEY) !== null ? Math.min(100, Math.max(0, v)) : 50;
  } catch {
    return 50;
  }
}
export function storeVolume(v: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.round(v)));
  } catch {
    /* private mode: it lasts for this visit */
  }
}
