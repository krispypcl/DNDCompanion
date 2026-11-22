/**
 * Sound effects, made on the spot with the Web Audio API: no files to load,
 * nothing to license. The game's sounds always play (the music players have
 * their own mute), quiet, and only ever for a moment, except the heartbeat,
 * which beats with the screen for as long as a character is dying. Button
 * sounds are quieter still, one family of soft clicks and notes (and the
 * faintest tick as the mouse comes onto a control), and can be turned off
 * (account Preferences).
 */
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
  deathBell: 'Death',
  levelUp: 'Level up',
  yourTurn: 'Your turn',
  coins: 'Coins',
  inspiration: 'Inspiration'
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
/** Plays the sheet's own recording for an effect, if it has one (the built-in one if it can't play). */
function own(name: SoundName): boolean {
  const url = custom[name];
  if (!url) return false;
  if (typeof Audio === 'undefined') return true;
  playClip(url, () => builtIn(name));
  return true;
}
/** Plays a recording once (also the preview beside its link); `instead` plays when it can't (a
    missing file, or a video its owner keeps on YouTube), never when the browser only waits for a tap. */
function playClip(url: string, instead?: () => void) {
  const yt = youtubeClip(url);
  if (yt) return void playYouTube(yt, instead);
  let clip = clips.get(url);
  if (!clip) {
    clip = new Audio(url);
    clip.preload = 'auto';
    clips.set(url, clip);
  }
  clip.currentTime = 0;
  clip.volume = 0.8;
  void clip.play().catch((e: unknown) => {
    if ((e as Error)?.name !== 'NotAllowedError') instead?.();
  });
}

// ── Sound effects from YouTube ──
// One hidden player, kept for the next effect: the first one has to load
// YouTube's player, every later one starts at once. A video that can't play
// there (its owner allows it on YouTube only) plays the effect's built-in sound.
let ytPlayer: YTPlayer | null = null;
let ytInstead: (() => void) | null = null;
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
          events: {
            onReady: () => resolve((ytPlayer = player)),
            onError: () => {
              const run = ytInstead;
              ytInstead = null;
              run?.();
            }
          }
        }) as unknown as YTPlayer;
        setTimeout(() => reject(new Error('YouTube did not load')), 15000);
      })
  ).catch((e) => {
    ytReady = null;
    throw e;
  });
  return ytReady;
}
async function playYouTube(clip: { video: string; start: number; end: number }, instead?: () => void) {
  try {
    const player = ytPlayer ?? (await youtubePlayer());
    ytInstead = instead ?? null;
    player.setVolume(80);
    player.unMute();
    player.loadVideoById({ videoId: clip.video, startSeconds: clip.start, endSeconds: clip.end });
  } catch {
    instead?.();
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

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
  const k = Math.max(1, Math.min(3, level)) / 3;
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
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
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

/**
 * One character's effect heard by the whole table (the campaign page's cards): its own recording
 * for that effect when it has one, otherwise the built-in sound. Its sounds come with the card, as
 * the page plays no single sheet's sounds of its own.
 */
export function playAs(name: 'hit' | 'heal' | 'shield' | 'deathBell', sounds: Partial<Record<SoundName, string>> | undefined, severity = 0.3) {
  const url = audioUrl(sounds?.[name]);
  const play = () => builtIn(name, severity);
  if (!url) return play();
  if (typeof Audio !== 'undefined') playClip(url, play);
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

// ── Moments new to the table ──

/** Leveling up: a fanfare climbing a chord, sparkling at its top. */
export function levelUp() {
  if (own('levelUp')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    tone(ac, t + i * 0.085, f, 0.9 - i * 0.1, 0.11, 'triangle');
    tone(ac, t + i * 0.085, f * 2, 0.35, 0.025, 'sine');
  });
  [2093, 2637, 3136].forEach((f, i) => tone(ac, t + 0.36 + i * 0.05, f, 0.5, 0.03, 'sine'));
}

/** Your turn in the fight: two bright notes, a call to look up. */
export function yourTurn() {
  if (own('yourTurn')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, t, 880, 0.35, 0.1, 'sine');
  tone(ac, t + 0.12, 1174.66, 0.55, 0.11, 'sine');
  tone(ac, t + 0.12, 1760, 0.3, 0.025, 'sine');
}

/** The DM calls for initiative: three war drum beats, the last the heaviest. */
export function initiativeCall() {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [[0, 0.6], [0.17, 0.7], [0.36, 1]].forEach(([at, g]) => {
    tone(ac, t + at, 105, 0.32, 0.4 * g, 'sine', 52);
    burst(ac, t + at, 0.09, 0.16 * g, 240, 0.8);
  });
}

/** The DM moves the turn on: a quiet wooden tick. */
export function nextTurn() {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  burst(ac, t, 0.03, 0.09, 2200, 4);
  tone(ac, t, 1400, 0.06, 0.025, 'sine');
}

/** A new round: a small gong, its partials out of tune with each other. */
export function newRound() {
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [[196, 0.09, 1.6], [196 * 2.76, 0.04, 1.1], [196 * 5.4, 0.02, 0.7], [196 * 1.5, 0.03, 1.3]].forEach(([f, g, d]) => tone(ac, t, f, d, g, 'sine'));
  burst(ac, t, 0.05, 0.05, 900, 1);
}

/** Money changing hands: a few coins clinking. */
export function coins() {
  if (own('coins')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  [0, 0.055, 0.1, 0.17].forEach((at, i) => {
    const f = 2600 + ((i * 937) % 1500);
    tone(ac, t + at, f, 0.16, 0.035, 'sine');
    tone(ac, t + at, f * 1.47, 0.1, 0.015, 'sine');
    burst(ac, t + at, 0.02, 0.05, 6500, 3);
  });
}

/** Inspiration gained: a sparkle running up; spent, two soft notes falling away. */
export function inspiration(gained = true) {
  if (gained && own('inspiration')) return;
  const ac = ready();
  if (!ac) return;
  const t = ac.currentTime;
  if (gained) {
    [1318.5, 1760, 2349.3, 2637].forEach((f, i) => tone(ac, t + i * 0.045, f, 0.55 - i * 0.07, 0.05, 'sine'));
    tone(ac, t + 0.2, 3136, 0.4, 0.015, 'sine');
  } else {
    tone(ac, t, 1318.5, 0.25, 0.04, 'sine');
    tone(ac, t + 0.09, 880, 0.35, 0.035, 'sine');
  }
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
  deathBell,
  levelUp,
  yourTurn,
  coins,
  inspiration: () => inspiration(true)
};

/** An effect's built-in sound, even with the sheet's own recordings set. */
function builtIn(name: SoundName, severity?: number) {
  const kept = custom;
  custom = {};
  try {
    if (name === 'hit' && severity !== undefined) hit(severity);
    else BUILT_IN[name]();
  } finally {
    custom = kept;
  }
}

/**
 * Plays an effect to hear it (the speaker beside its name): the link in its
 * field if there is one, otherwise the built-in sound.
 */
export function previewSound(name: SoundName, link?: string | null) {
  const url = audioUrl(link);
  if (url) return playClip(url, () => builtIn(name));
  builtIn(name);
}

// ── Button sounds ──
// One family, made like the rest and quieter than any of them: a press is a
// soft click, and moments with their own meaning (a switch, a tab, a window,
// a place, a drag, something added, removed, done, or gone wrong) have a note
// of their own. A press and what it opens come together: only the stronger
// of the sounds in one moment plays (`cue`), so opening a window is heard as
// the window, not as the press and the window at once.

/** Where the choice is kept on this device (prefs.ts writes it; account Preferences). */
export const BUTTON_SOUNDS_KEY = 'dndcompanion:buttonSounds';
let buttonSounds = (() => {
  try {
    return typeof localStorage === 'undefined' || localStorage.getItem(BUTTON_SOUNDS_KEY) !== 'off';
  } catch {
    return true;
  }
})();
export function setButtonSounds(on: boolean) {
  buttonSounds = on;
}

const UI = {
  press(ac: AudioContext, t: number) {
    burst(ac, t, 0.022, 0.045, 2600, 3);
    tone(ac, t, 1250, 0.045, 0.02, 'sine');
  },
  back(ac: AudioContext, t: number) {
    tone(ac, t, 880, 0.08, 0.03, 'sine', 600);
    burst(ac, t, 0.02, 0.03, 1800, 3);
  },
  switchOn(ac: AudioContext, t: number) {
    tone(ac, t, 660, 0.06, 0.03, 'sine');
    tone(ac, t + 0.045, 990, 0.08, 0.03, 'sine');
  },
  switchOff(ac: AudioContext, t: number) {
    tone(ac, t, 990, 0.06, 0.025, 'sine');
    tone(ac, t + 0.045, 660, 0.08, 0.025, 'sine');
  },
  tab(ac: AudioContext, t: number) {
    burst(ac, t, 0.018, 0.04, 3400, 4);
    tone(ac, t, 1520, 0.05, 0.018, 'sine');
  },
  open(ac: AudioContext, t: number) {
    sweep(ac, t, 0.16, 0.05, 700, 2400);
    tone(ac, t, 520, 0.14, 0.02, 'sine', 780);
  },
  close(ac: AudioContext, t: number) {
    sweep(ac, t, 0.14, 0.045, 2400, 700);
    tone(ac, t, 700, 0.12, 0.018, 'sine', 470);
  },
  place(ac: AudioContext, t: number) {
    tone(ac, t, 740, 0.07, 0.025, 'sine');
    tone(ac, t + 0.03, 1110, 0.08, 0.02, 'sine');
  },
  pickUp(ac: AudioContext, t: number) {
    tone(ac, t, 420, 0.09, 0.035, 'sine', 640);
    burst(ac, t, 0.03, 0.03, 1900, 2);
  },
  drop(ac: AudioContext, t: number) {
    tone(ac, t, 520, 0.1, 0.035, 'sine', 330);
    burst(ac, t + 0.02, 0.04, 0.05, 900, 1.5);
  },
  added(ac: AudioContext, t: number) {
    tone(ac, t, 880, 0.08, 0.03, 'sine');
    tone(ac, t + 0.05, 1318.5, 0.12, 0.03, 'sine');
  },
  removed(ac: AudioContext, t: number) {
    tone(ac, t, 300, 0.11, 0.045, 'sine', 150);
    burst(ac, t, 0.04, 0.035, 600, 1.2);
  },
  success(ac: AudioContext, t: number) {
    [783.99, 987.77, 1318.5].forEach((f, i) => tone(ac, t + i * 0.05, f, 0.14, 0.028, 'sine'));
  },
  error(ac: AudioContext, t: number) {
    tone(ac, t, 330, 0.12, 0.04, 'triangle');
    tone(ac, t + 0.1, 262, 0.16, 0.04, 'triangle');
  },
  pageTurn(ac: AudioContext, t: number) {
    sweep(ac, t, 0.13, 0.05, 3200, 1400, 1.4);
  },
  /** The loading die starting to tumble: a few dice tapping, softly. */
  tumble(ac: AudioContext, t: number) {
    for (let i = 0; i < 5; i++) burst(ac, t + i * 0.07 + Math.random() * 0.02, 0.03, 0.045 * (1 - i / 7), 2000 + Math.random() * 2000, 2);
  },
  /** It lands on a 20 (loaded): a knock and a small bright ping. */
  landed(ac: AudioContext, t: number) {
    burst(ac, t, 0.04, 0.06, 1100, 1.5);
    tone(ac, t, 1568, 0.18, 0.02, 'sine');
    tone(ac, t + 0.06, 2093, 0.22, 0.018, 'sine');
  },
  /** It lands on a 1 (it couldn't load): a knock and a low note. */
  fumbled(ac: AudioContext, t: number) {
    burst(ac, t, 0.05, 0.06, 700, 1.2);
    tone(ac, t, 220, 0.22, 0.035, 'triangle', 150);
  },
  /** The pointer coming onto a control (a computer only): the faintest tick. */
  hover(ac: AudioContext, t: number) {
    tone(ac, t, 2100, 0.03, 0.009, 'sine');
  }
} as const;
export type UiSound = keyof typeof UI;

/** Noise swept from one pitch to another: air, paper. */
function sweep(ac: AudioContext, at: number, dur: number, gain: number, from: number, to: number, q = 0.9) {
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(at, Math.random() * 0.3, dur + 0.05);
}

/** The table's moments that can stand in for the press that made them (the DM's Start, Next, Call). */
const MOMENTS = { initiativeCall, nextTurn, newRound, yourTurn } as const;
type Cue = UiSound | keyof typeof MOMENTS;
/** How much each says: in one moment, only the strongest plays. */
const WEIGHT: Partial<Record<Cue, number>> = {
  hover: 0.5, press: 1, tumble: 1.5, landed: 2, fumbled: 2, back: 2, tab: 2, place: 2, switchOn: 2, switchOff: 2, added: 2, removed: 2, pageTurn: 2,
  pickUp: 3, drop: 3, open: 3, close: 3, success: 4, error: 4, nextTurn: 5, newRound: 6, initiativeCall: 6, yourTurn: 6
};
let pending: Cue | null = null;
/**
 * A sound for this moment; what else asks in the same moment (before the page has drawn it) may
 * outweigh it. Button sounds stay quiet when they are turned off; the table's moments never do.
 */
export function cue(name: Cue) {
  if (!(name in MOMENTS) && !buttonSounds) return;
  if (pending && (WEIGHT[pending] ?? 0) >= (WEIGHT[name] ?? 0)) return;
  const first = pending === null;
  pending = name;
  if (first) setTimeout(flush, 0);
}
function flush() {
  const name = pending;
  pending = null;
  if (!name) return;
  if (name in MOMENTS) return void MOMENTS[name as keyof typeof MOMENTS]();
  const ac = ready();
  if (ac) UI[name as UiSound](ac, ac.currentTime);
}

/** A window heard as it opens and as it goes: `$effect(windowSounds)` in a window that exists only while open. */
export function windowSounds(): () => void {
  cue('open');
  return () => cue('close');
}

/** The order's moments (rules/initiative initiativeMoments), heard in turn: a new round, then your turn a beat later. */
export function hearMoments(list: (keyof typeof MOMENTS)[]) {
  list.forEach((name, i) => (i ? setTimeout(() => cue(name), i * 450) : cue(name)));
}

/** Which sound a pressed control makes: its own data-sound, else what it is and says. */
export function soundOf(el: Element): UiSound | null {
  const own = el.closest<HTMLElement>('[data-sound]')?.dataset.sound;
  if (own) return own === 'none' ? null : own in UI ? (own as UiSound) : 'press';
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return null;
  const role = el.getAttribute('role');
  if (role === 'switch' || el.hasAttribute('aria-pressed')) {
    const on = el.getAttribute(role === 'switch' ? 'aria-checked' : 'aria-pressed') === 'true';
    return on ? 'switchOff' : 'switchOn';
  }
  if (role === 'tab') return 'tab';
  if (el.closest('.phonebar, .bottombar')) return 'place';
  if (el.matches('.closex, .backlink')) return 'back';
  const words = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().toLowerCase();
  if (/^(cancel|keep|back|close|not now|never mind)\b/.test(words)) return 'back';
  if (/^(remove|delete|forget|take .* (away|out)|clear)\b/.test(words)) return 'removed';
  if (/^(add|give|new|invite)\b/.test(words)) return 'added';
  return 'press';
}
const CONTROL = 'button, a[href], [role="button"], [role="tab"], [role="switch"], summary';
/** Every press on the page (the layout listens): its sound, if it is a control. */
export function pressed(event: Event) {
  const at = (event.target as Element | null)?.closest?.(CONTROL);
  if (!at) return;
  const name = soundOf(at);
  if (name) cue(name);
}
let hoverAt: Element | null = null;
let hoverTime = -Infinity;
/**
 * The mouse coming onto a control (the layout listens on a computer): once per control entered,
 * none while a button is held (a drag), and never more than one in 70ms, so sweeping across a row
 * of buttons is not a rattle. Not for a disabled or quiet control (soundOf).
 */
export function hovered(event: PointerEvent) {
  if (event.pointerType !== 'mouse' || event.buttons) return;
  const at = (event.target as Element | null)?.closest?.(CONTROL) ?? null;
  if (at === hoverAt) return;
  hoverAt = at;
  if (!at || soundOf(at) === null) return;
  const now = performance.now();
  if (now - hoverTime < 70) return;
  hoverTime = now;
  cue('hover');
}
/** Something gone wrong, shown (an element with role="alert" arriving): its sound. Returns how to stop. */
export function listenForAlerts(root: Node): () => void {
  if (typeof MutationObserver === 'undefined') return () => {};
  const seen = new WeakSet<Element>();
  const look = (n: Node) => {
    if (!(n instanceof Element)) return false;
    const found = n.matches('[role="alert"]') ? n : n.querySelector('[role="alert"]');
    if (!found || seen.has(found) || !found.textContent?.trim()) return false;
    seen.add(found);
    return true;
  };
  const watcher = new MutationObserver((records) => {
    if (records.some((r) => [...r.addedNodes].some(look))) cue('error');
  });
  watcher.observe(root, { childList: true, subtree: true });
  return () => watcher.disconnect();
}

/** For tests: forget the audio context. */
export function _resetSound() {
  hoverAt = null;
  hoverTime = -Infinity;
  ctx = null;
  master = null;
  noiseBuf = null;
}
