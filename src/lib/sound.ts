/**
 * Sound effects, made on the spot with the Web Audio API: no files to load,
 * nothing to license. Off unless the reader turns them on (the speaker beside
 * the light/dark switch), remembered per device like the mode, quiet, and
 * only ever for a moment, except the heartbeat, which beats with the screen
 * for as long as a character is dying.
 */
import { get, writable } from 'svelte/store';
import { loadYouTube, youtubeClip, type YTPlayer } from './music';

const SOUND_KEY = 'dndcompanion:sound';

function stored(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}

export const soundOn = writable<boolean>(typeof document === 'undefined' ? false : stored());

export function setSound(on: boolean) {
  soundOn.set(on);
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* private mode: it lasts for this visit */
  }
  if (on) {
    // Turning it on is a press, which is what lets a phone start audio.
    ready()?.resume?.();
    click();
  }
}

/**
 * A sheet's own sounds: any effect can be swapped for a recording at a link
 * (an mp3 or similar; a Google Drive or Dropbox share link works too). Set by
 * the sheet on screen; empty everywhere else.
 */
export const SOUND_NAMES = {
  dice: 'Dice rolling',
  land: 'Dice landing',
  nat20: 'Natural 20',
  nat1: 'Natural 1',
  hit: 'Taking damage',
  heal: 'Healing',
  shield: 'Temporary hit points',
  shortRest: 'Short rest',
  longRest: 'Long rest',
  dawn: 'Dawn',
  deathSave: 'Death save',
  deathBell: 'Death'
} as const;
export type SoundName = keyof typeof SOUND_NAMES;
let custom: Partial<Record<SoundName, string>> = {};
const clips = new Map<string, HTMLAudioElement>();
export function setCustomSounds(next: Partial<Record<SoundName, string>> | undefined) {
  custom = {};
  for (const [k, v] of Object.entries(next ?? {})) {
    const url = audioUrl(v);
    if (url) custom[k as SoundName] = url;
  }
}
/** A share link turned into the file itself, where the service allows it. A
    YouTube link stays as it is: it plays through a hidden YouTube player. */
export function audioUrl(raw: string | undefined | null): string | null {
  const text = String(raw ?? '').trim();
  if (youtubeClip(text)) return /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const u = new URL(text);
    if (/(^|\.)drive\.google\.com$/i.test(u.hostname)) {
      const id = u.pathname.match(/\/d\/([\w-]+)/)?.[1] ?? u.searchParams.get('id');
      if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
    }
    if (/(^|\.)dropbox\.com$/i.test(u.hostname)) {
      u.searchParams.delete('dl');
      u.searchParams.set('raw', '1');
      return u.toString();
    }
    return u.toString();
  } catch {
    return null;
  }
}
/** Plays the sheet's own recording for an effect, if it has one. */
function own(name: SoundName): boolean {
  const url = custom[name];
  if (!url) return false;
  if (!get(soundOn) || typeof Audio === 'undefined') return true;
  playClip(url);
  return true;
}
/** Plays a recording once (also the preview beside its link). */
export function playClip(url: string) {
  const yt = youtubeClip(url);
  if (yt) return void playYouTube(yt);
  let clip = clips.get(url);
  if (!clip) {
    clip = new Audio(url);
    clip.preload = 'auto';
    clips.set(url, clip);
  }
  clip.currentTime = 0;
  clip.volume = 0.8;
  void clip.play().catch(() => {});
}

// ── Sound effects from YouTube ──
// One hidden player, kept for the next effect: the first one has to load
// YouTube's player, every later one starts at once.
let ytPlayer: YTPlayer | null = null;
let ytReady: Promise<YTPlayer> | null = null;
function youtubePlayer(): Promise<YTPlayer> {
  ytReady ??= loadYouTube().then(
    (YT) =>
      new Promise<YTPlayer>((resolve, reject) => {
        const host = document.createElement('div');
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:200px;opacity:0;pointer-events:none;';
        const inner = document.createElement('div');
        host.appendChild(inner);
        document.body.appendChild(host);
        const player = new YT.Player(inner, {
          width: 200,
          height: 200,
          playerVars: { controls: 0, playsinline: 1, disablekb: 1 },
          events: { onReady: () => resolve((ytPlayer = player)), onError: () => {} }
        }) as unknown as YTPlayer;
        setTimeout(() => reject(new Error('YouTube did not load')), 15000);
      })
  ).catch((e) => {
    ytReady = null;
    throw e;
  });
  return ytReady;
}
async function playYouTube(clip: { video: string; start: number; end: number }) {
  try {
    const player = ytPlayer ?? (await youtubePlayer());
    player.setVolume(80);
    player.unMute();
    player.loadVideoById({ videoId: clip.video, startSeconds: clip.start, endSeconds: clip.end });
  } catch {
    /* No YouTube: the effect is simply silent. */
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

/** The audio context, or null when sound is off or unavailable. */
function ready(): AudioContext | null {
  if (!get(soundOn) || typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function noise(ac: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(ac.sampleRate * 0.5);
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/** A tone with a quick attack and an exponential fall. */
function tone(ac: AudioContext, at: number, freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slideTo?: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(master!);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** A burst of filtered noise: a die hitting wood, a knock. */
function burst(ac: AudioContext, at: number, dur: number, gain: number, freq: number, q = 1.2) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(at, Math.random() * 0.3, dur + 0.05);
}

/** The toggle's own confirmation. */
function click() {
  const ac = ready();
  if (!ac) return;
  tone(ac, ac.currentTime, 1400, 0.05, 0.12, 'triangle');
}

/** Dice rattling across a table: one knock per die, a few bounces each. */
export function clatter(dice = 1, ms = 420) {
  if (own('dice')) return;
  const ac = ready();
  if (!ac) return;
  const t0 = ac.currentTime;
  const hits = Math.min(18, 3 + dice * 3);
  for (let i = 0; i < hits; i++) {
    const at = t0 + (Math.random() * ms) / 1000 * (0.4 + (i / hits) * 0.6);
    burst(ac, at, 0.035 + Math.random() * 0.03, 0.25 * (1 - i / (hits * 1.4)), 1800 + Math.random() * 2600, 2);
  }
}

/** The dice come to rest. */
export function land() {
  if (own('land')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  burst(ac, t, 0.06, 0.35, 900, 1.5);
  tone(ac, t, 220, 0.12, 0.18, 'sine', 140);
}

/** A natural 20: a bright rising chime. */
export function nat20() {
  if (own('nat20')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
    tone(ac, t + i * 0.07, f, 1.1 - i * 0.12, 0.16, 'sine');
    tone(ac, t + i * 0.07, f * 2.01, 0.5, 0.03, 'sine');
  });
}

/** A natural 1: a dull falling thud. */
export function nat1() {
  if (own('nat1')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, t, 160, 0.45, 0.35, 'sine', 48);
  burst(ac, t, 0.18, 0.2, 260, 0.8);
  tone(ac, t + 0.12, 98, 0.4, 0.12, 'triangle', 60);
}

/** One heartbeat, "lub-dub", starting `delay` seconds from now. */
export function heartbeat(delay = 0, strength = 1) {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const thump = (at: number, g: number) => {
    tone(ac, at, 75, 0.22, 0.55 * g * strength, 'sine', 38);
    burst(ac, at, 0.08, 0.12 * g * strength, 140, 0.7);
  };
  thump(t, 1);
  thump(t + 0.3, 0.7);
}

/** A death save lands: a bright tick for a success, a hard knock for a failure,
    louder from the first pip to the third. */
export function deathSave(kind: 'save' | 'fail', level: number) {
  if (own('deathSave')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const k = Math.max(1, Math.min(3, level)) / 3;
  if (kind === 'save') {
    tone(ac, t, 880 + level * 220, 0.35 + k * 0.4, 0.08 + k * 0.14, 'sine');
    tone(ac, t, (880 + level * 220) * 1.5, 0.25 + k * 0.3, 0.04 + k * 0.06, 'sine');
  } else {
    tone(ac, t, 130 - level * 15, 0.3 + k * 0.3, 0.25 + k * 0.3, 'sine', 45);
    burst(ac, t, 0.12 + k * 0.1, 0.15 + k * 0.25, 320, 0.9);
  }
}

/** Death: a low, slow bell. */
export function deathBell() {
  if (own('deathBell')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.25;
  // Inharmonic partials are what make a bell sound like one.
  [[110, 0.3, 4], [220 * 1.19, 0.12, 3], [330 * 1.06, 0.1, 2.4], [550 * 0.97, 0.05, 1.6]].forEach(([f, g, d]) =>
    tone(ac, t, f, d, g, 'sine')
  );
}

/** Damage: a body blow, heavier and lower the harder the hit (0 to 1). */
export function hit(severity = 0.3) {
  if (own('hit')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  const k = Math.max(0, Math.min(1, severity));
  tone(ac, t, 190 - k * 90, 0.18 + k * 0.25, 0.28 + k * 0.3, 'sine', 55);
  burst(ac, t, 0.07 + k * 0.08, 0.25 + k * 0.2, 700 - k * 400, 1.1);
}

/** Healing: a soft rising shimmer. */
export function heal() {
  if (own('heal')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, t + i * 0.06, f, 0.6, 0.07, 'sine'));
  tone(ac, t, 392, 0.7, 0.05, 'triangle', 784);
}

/** Temporary hit points: a bright, metallic ring, like a shield raised. */
export function shield() {
  if (own('shield')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [[1180, 0.12], [1770 * 1.01, 0.06], [2650, 0.035]].forEach(([f, g]) => tone(ac, t, f, 0.7, g, 'sine'));
  burst(ac, t, 0.05, 0.12, 4200, 3);
}

/** A short rest: two soft, low notes, settling. */
export function shortRest() {
  if (own('shortRest')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, t, 392, 0.6, 0.1, 'triangle');
  tone(ac, t + 0.18, 329.63, 0.9, 0.09, 'triangle');
}

/** A long rest: a slow, warm chord, rolled upward. */
export function longRest() {
  if (own('longRest')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [261.63, 329.63, 392, 523.25].forEach((f, i) => tone(ac, t + i * 0.12, f, 1.6 - i * 0.15, 0.08, 'sine'));
}

/** Dawn: a bright rising call, the day starting. */
export function dawn() {
  if (own('dawn')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [587.33, 739.99, 880, 1174.66].forEach((f, i) => {
    tone(ac, t + i * 0.09, f, 0.9, 0.08, 'sine');
    tone(ac, t + i * 0.09, f * 2, 0.4, 0.02, 'sine');
  });
}

/** For tests: forget the audio context. */
export function _resetSound() {
  ctx = null;
  master = null;
  noiseBuf = null;
}
