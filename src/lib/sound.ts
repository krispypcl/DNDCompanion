/**
 * Sound effects, made on the spot with the Web Audio API: no files to load,
 * nothing to license. Off unless the reader turns them on (the speaker beside
 * the light/dark switch), remembered per device like the mode, quiet, and
 * only ever for a moment, except the heartbeat, which beats with the screen
 * for as long as a character is dying.
 */
import { get, writable } from 'svelte/store';

export const SOUND_KEY = 'dndcompanion:sound';

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
export function click() {
  const ac = ready();
  if (!ac) return;
  tone(ac, ac.currentTime, 1400, 0.05, 0.12, 'triangle');
}

/** Dice rattling across a table: one knock per die, a few bounces each. */
export function clatter(dice = 1, ms = 420) {
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
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  burst(ac, t, 0.06, 0.35, 900, 1.5);
  tone(ac, t, 220, 0.12, 0.18, 'sine', 140);
}

/** A natural 20: a bright rising chime. */
export function nat20() {
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
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime + 0.25;
  // Inharmonic partials are what make a bell sound like one.
  [[110, 0.3, 4], [220 * 1.19, 0.12, 3], [330 * 1.06, 0.1, 2.4], [550 * 0.97, 0.05, 1.6]].forEach(([f, g, d]) =>
    tone(ac, t, f, d, g, 'sine')
  );
}

/** For tests: forget the audio context. */
export function _resetSound() {
  ctx = null;
  master = null;
  noiseBuf = null;
}
