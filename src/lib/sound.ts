/**
 * Sound effects: recordings from a small sound bank (static/sounds, CC0
 * packs by Kenney and artisticdude, see its LICENSE.txt), played through the
 * Web Audio API. Always on (the music players have their own mute), quiet,
 * and only ever for a moment, except the heartbeat, which beats with the
 * screen for as long as a character is dying.
 *
 * The bank loads once a sheet or a dice tray is on screen (warmSounds), and
 * the service worker keeps it after that. Until it has loaded, or where the
 * browser can't read a file, each effect falls back to one made on the spot,
 * so there is always a sound.
 */
import { base } from './base.ts';
import { loadYouTube, youtubeClip, type YTPlayer } from './music.ts';

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
  if (typeof Audio === 'undefined') return true;
  playClip(url);
  return true;
}
/** Plays a recording once (also the preview beside its link). */
function playClip(url: string) {
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

// ── The sound bank ──
/** Each effect's recordings; one of several is picked at random, so repeats differ. */
const BANK = {
  shake: ['dice-shake-1.ogg', 'dice-shake-2.ogg'],
  dice: ['dice-throw-1.ogg', 'dice-throw-2.ogg', 'dice-throw-3.ogg'],
  die: ['die-throw-1.ogg', 'die-throw-2.ogg', 'die-throw-3.ogg'],
  nat20: ['nat20.ogg'],
  nat1: ['nat1.ogg'],
  hit: ['hit.ogg'],
  thud: ['thud.ogg'],
  heal: ['heal.wav'],
  shield: ['shield.wav'],
  shortRest: ['short-rest.ogg'],
  longRest: ['long-rest.ogg'],
  dawn: ['dawn.ogg'],
  save: ['save.ogg'],
  bell: ['bell.ogg']
} as const;
type BankKey = keyof typeof BANK;
const recordings = new Map<string, AudioBuffer>();
let bankLoad: Promise<void> | null = null;

/**
 * Loads the bank, once. Decoded off screen (an OfflineAudioContext), so it
 * needs no press first and never wakes the speakers.
 */
export function warmSounds(): Promise<void> {
  if (bankLoad) return bankLoad;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return Promise.resolve();
  const Offline = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Offline) return Promise.resolve();
  const decoder = new Offline(1, 1, 44100);
  bankLoad = Promise.all(
    [...new Set(Object.values(BANK).flat())].map(async (file) => {
      try {
        const res = await fetch(`${base}/sounds/${file}`);
        if (!res.ok) return;
        recordings.set(file, await decoder.decodeAudioData(await res.arrayBuffer()));
      } catch {
        /* Not this one: its effect is made on the spot instead. */
      }
    })
  ).then(() => {});
  return bankLoad;
}

/**
 * Plays a recording from the bank: `at` seconds from now, faster or slower
 * (`rate`, which also shifts its pitch), louder or softer, and cut short
 * with a quick fade (`length`). False when it isn't loaded, so the caller
 * makes the sound itself.
 */
function recording(key: BankKey, { at = 0, rate = 1, gain = 1, length }: { at?: number; rate?: number; gain?: number; length?: number } = {}): boolean {
  void warmSounds();
  const list = BANK[key];
  const start = Math.floor(Math.random() * list.length);
  let buf: AudioBuffer | undefined;
  for (let i = 0; i < list.length && !buf; i++) buf = recordings.get(list[(start + i) % list.length]);
  if (!buf) return false;
  const ac = ready();
  if (!ac) return true;
  const t = ac.currentTime + at;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t);
  if (length) {
    g.gain.setValueAtTime(gain, Math.max(t, t + length - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.start(t, 0, length + 0.02);
  } else {
    src.start(t);
  }
  src.connect(g).connect(master!);
  return true;
}
/** How many dice the last roll threw, for the sound of them landing. */
let thrown = 1;

/** The audio context, or null where there's no Web Audio. */
function ready(): AudioContext | null {
  if (typeof window === 'undefined') return null;
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

/** Dice shaken while they tumble (made on the spot: one knock per die, a few bounces each). */
export function clatter(dice = 1, ms = 420) {
  thrown = dice;
  if (own('dice') || recording('shake', { gain: 1.3, length: ms / 1000 + 0.12 })) return;
  const ac = ready();
  if (!ac) return;
  const t0 = ac.currentTime;
  const hits = Math.min(18, 3 + dice * 3);
  for (let i = 0; i < hits; i++) {
    const at = t0 + (Math.random() * ms) / 1000 * (0.4 + (i / hits) * 0.6);
    burst(ac, at, 0.035 + Math.random() * 0.03, 0.25 * (1 - i / (hits * 1.4)), 1800 + Math.random() * 2600, 2);
  }
}

/** The dice hit the table and come to rest. */
export function land() {
  if (own('land') || landed()) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  burst(ac, t, 0.06, 0.35, 900, 1.5);
  tone(ac, t, 220, 0.12, 0.18, 'sine', 140);
}

/** The dice hitting the table, from the bank. */
const landed = (gain = 1.2) => recording(thrown > 1 ? 'dice' : 'die', { gain });

/** A natural 20: the dice land, and a bright run rises. */
export function nat20() {
  if (own('nat20')) return;
  if (recording('nat20', { at: 0.06, gain: 0.75 })) return void landed(0.8);
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
    tone(ac, t + i * 0.07, f, 1.1 - i * 0.12, 0.16, 'sine');
    tone(ac, t + i * 0.07, f * 2.01, 0.5, 0.03, 'sine');
  });
}

/** A natural 1: the dice land, and a run falls. */
export function nat1() {
  if (own('nat1')) return;
  if (recording('nat1', { at: 0.06, gain: 0.75 })) return void landed(0.8);
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
  const k = Math.max(1, Math.min(3, level)) / 3;
  const step = Math.max(1, Math.min(3, level)) - 1;
  if (kind === 'save' ? recording('save', { rate: 1 + step * 0.12, gain: 0.35 + k * 0.5 }) : recording('thud', { rate: 1 - step * 0.08, gain: 0.5 + k * 0.6 })) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
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
  // A pot's ring, an octave down, is a slow bell.
  if (recording('bell', { at: 0.25, rate: 0.5, gain: 1 })) return;
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
  const k = Math.max(0, Math.min(1, severity));
  if (recording('hit', { rate: 1.15 - k * 0.4, gain: 0.5 + k * 0.5 })) {
    if (k > 0.5) recording('thud', { rate: 0.9, gain: k * 0.8 });
    return;
  }
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, t, 190 - k * 90, 0.18 + k * 0.25, 0.28 + k * 0.3, 'sine', 55);
  burst(ac, t, 0.07 + k * 0.08, 0.25 + k * 0.2, 700 - k * 400, 1.1);
}

/** Healing: a soft rising shimmer. */
export function heal() {
  if (own('heal') || recording('heal', { gain: 0.6 })) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, t + i * 0.06, f, 0.6, 0.07, 'sine'));
  tone(ac, t, 392, 0.7, 0.05, 'triangle', 784);
}

/** Temporary hit points: a bright, metallic ring, like a shield raised. */
export function shield() {
  if (own('shield') || recording('shield', { gain: 0.5 })) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [[1180, 0.12], [1770 * 1.01, 0.06], [2650, 0.035]].forEach(([f, g]) => tone(ac, t, f, 0.7, g, 'sine'));
  burst(ac, t, 0.05, 0.12, 4200, 3);
}

/** A short rest: two soft notes, settling. */
export function shortRest() {
  if (own('shortRest') || recording('shortRest', { gain: 0.7 })) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, t, 392, 0.6, 0.1, 'triangle');
  tone(ac, t + 0.18, 329.63, 0.9, 0.09, 'triangle');
}

/** A long rest: a slow phrase, winding down. */
export function longRest() {
  if (own('longRest') || recording('longRest', { gain: 0.7 })) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [261.63, 329.63, 392, 523.25].forEach((f, i) => tone(ac, t + i * 0.12, f, 1.6 - i * 0.15, 0.08, 'sine'));
}

/** Dawn: a bright rising call, the day starting. */
export function dawn() {
  if (own('dawn') || recording('dawn', { gain: 0.7 })) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [587.33, 739.99, 880, 1174.66].forEach((f, i) => {
    tone(ac, t + i * 0.09, f, 0.9, 0.08, 'sine');
    tone(ac, t + i * 0.09, f * 2, 0.4, 0.02, 'sine');
  });
}

const BUILT_IN: Record<SoundName, () => void> = {
  dice: () => clatter(2),
  land,
  nat20,
  nat1,
  hit: () => hit(0.5),
  heal,
  shield,
  shortRest,
  longRest,
  dawn,
  deathSave: () => deathSave('save', 2),
  deathBell
};

/**
 * Plays an effect to hear it (the speaker beside its name): the link in its
 * field if there is one, otherwise the built-in sound, even with the sheet's
 * own recordings set.
 */
export function previewSound(name: SoundName, link?: string | null) {
  const url = audioUrl(link);
  if (url) return playClip(url);
  const kept = custom;
  custom = {};
  try {
    BUILT_IN[name]();
  } finally {
    custom = kept;
  }
}

/** For tests: forget the audio context. */
export function _resetSound() {
  ctx = null;
  master = null;
  noiseBuf = null;
  recordings.clear();
  bankLoad = null;
}
