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

/** A playlist asked for by its id, from one of its songs. (A list of video
    ids is not used: YouTube quietly ignores a long one.) */
type PlaylistRequest = { list: string; listType: 'playlist'; index?: number };
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
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
  setShuffle(on: boolean): void;
  setLoop(on: boolean): void;
  playVideoAt(index: number): void;
  cuePlaylist(list: PlaylistRequest): void;
  loadPlaylist(list: PlaylistRequest): void;
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

const SHUFFLE_KEY = 'dndcompanion:shuffle';
/** Shuffle, for a reader who is not signed in: remembered on this device. */
export function storedShuffle(): boolean {
  try {
    return localStorage.getItem(SHUFFLE_KEY) === 'on';
  } catch {
    return false;
  }
}
export function storeShuffle(on: boolean) {
  try {
    localStorage.setItem(SHUFFLE_KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: it lasts for this visit */
  }
}

/**
 * Loop, for a reader who is not signed in, remembered on this device. A
 * sheet's music plays through once unless told to loop; a jukebox repeats
 * the chosen song unless told to move on.
 */
const loopKey = (place: 'sheet' | 'campaign') => (place === 'sheet' ? 'dndcompanion:loop' : 'dndcompanion:jukebox-loop');
export function storedLoop(place: 'sheet' | 'campaign'): boolean {
  try {
    const v = localStorage.getItem(loopKey(place));
    return v === null ? place === 'campaign' : v === 'on';
  } catch {
    return place === 'campaign';
  }
}
export function storeLoop(place: 'sheet' | 'campaign', on: boolean) {
  try {
    localStorage.setItem(loopKey(place), on ? 'on' : 'off');
  } catch {
    /* private mode: it lasts for this visit */
  }
}

/** A copy in random order (Fisher–Yates). */
export function shuffled<T>(list: T[], random: () => number = Math.random): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 83 → "1:23"; 3723 → "1:02:03". */
export function clock(seconds: number): string {
  const t = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
