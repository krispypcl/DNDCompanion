/**
 * Preferences (account page): the look and feel a player chooses.
 *
 * - Light, dark, or the device's own (stores/mode.ts), reduced motion, the
 *   dice style, and button sounds apply to this device at once and are kept
 *   on it, so they work signed out and before the page has loaded (src/app.html
 *   reads the look and motion).
 * - They are also saved on the account (profiles.preferences), so a
 *   device that has never chosen starts with them.
 */
import { chooseMode, choiceKept, type ModeChoice } from '#lib/stores/mode.ts';
import { savePreferences, type ProfileRow } from '#lib/stores/profile.ts';
import { BUTTON_SOUNDS_KEY, setButtonSounds as hearButtons } from '#lib/sound.ts';

const MOTION_KEY = 'dndcompanion:motion';
const DICE_KEY = 'dndcompanion:dice';

/** How the dice roller shows a roll: the faces tumble, then land; or the total at once. */
export type DiceStyle = 'tumble' | 'quick';

export type Prefs = {
  mode?: ModeChoice;
  /** null: follows each device's own setting. */
  reduceMotion?: boolean | null;
  dice?: DiceStyle;
  buttonSounds?: boolean;
};

/** The look, motion, and dice kept in the player's profile (preferences). */
function prefsOf(row: ProfileRow | null | undefined): Prefs {
  const p = row?.preferences ?? {};
  return {
    ...(p.mode === 'light' || p.mode === 'dark' || p.mode === 'system' ? { mode: p.mode as ModeChoice } : {}),
    ...(typeof p.reduceMotion === 'boolean' ? { reduceMotion: p.reduceMotion } : {}),
    ...(p.dice === 'tumble' || p.dice === 'quick' ? { dice: p.dice as DiceStyle } : {}),
    ...(typeof p.buttonSounds === 'boolean' ? { buttonSounds: p.buttonSounds } : {})
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // A private window can refuse; the choice still applies for this visit.
  }
}

/*
 * Motion: the device's own setting decides, until the player chooses on the
 * account page. Whichever decides, the page carries the answer as
 * html[data-motion] = 'reduce' | 'full', and every rule and transition reads
 * only that (app.html sets it before the first paint, the same way).
 */
const deviceQuery = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null);
const deviceReduces = () => deviceQuery()?.matches ?? false;

/** Reduced motion as it stands: the player's choice, else the device's. */
export function reduceMotionNow(): boolean {
  const kept = read(MOTION_KEY);
  return kept === 'reduce' || (kept !== 'full' && deviceReduces());
}
/** Marks the page with what reduceMotionNow() says. */
export function applyMotion() {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-motion', reduceMotionNow() ? 'reduce' : 'full');
}
/**
 * The player's choice. Choosing what the device already says goes back to
 * following the device, so a choice never sticks past its use.
 */
export function setReduceMotion(on: boolean): boolean | null {
  const choice = on === deviceReduces() ? null : on;
  write(MOTION_KEY, choice === null ? null : choice ? 'reduce' : 'full');
  applyMotion();
  /** What the account keeps: the choice, or null to follow each device. */
  return choice;
}
/** Follows the device's setting changing while the app is open; returns a stop. */
export function followDeviceMotion(): () => void {
  const q = deviceQuery();
  if (!q) return () => {};
  q.addEventListener('change', applyMotion);
  return () => q.removeEventListener('change', applyMotion);
}

export function storedDice(): DiceStyle {
  return read(DICE_KEY) === 'quick' ? 'quick' : 'tumble';
}
export function setDiceStyle(style: DiceStyle) {
  write(DICE_KEY, style);
}

/** Whether buttons make their soft sounds (on unless turned off). */
export function storedButtonSounds(): boolean {
  return read(BUTTON_SOUNDS_KEY) !== 'off';
}
export function setButtonSounds(on: boolean) {
  write(BUTTON_SOUNDS_KEY, on ? 'on' : 'off');
  hearButtons(on);
}

/** Keeps a change on the account (merged into what is there). */
export async function savePrefs(patch: Prefs) {
  await savePreferences(patch);
}

/**
 * A device that has never chosen takes the account's preferences on signing
 * in; one that has keeps its own.
 */
export function adoptAccountPrefs(row: ProfileRow | null | undefined) {
  const p = prefsOf(row);
  if (p.mode && !choiceKept()) chooseMode(p.mode);
  // A device following its own setting takes the account's choice, if it has one.
  if (typeof p.reduceMotion === 'boolean' && read(MOTION_KEY) === null) setReduceMotion(p.reduceMotion);
  if (p.dice && read(DICE_KEY) === null) setDiceStyle(p.dice);
  if (p.buttonSounds !== undefined && read(BUTTON_SOUNDS_KEY) === null) setButtonSounds(p.buttonSounds);
}
