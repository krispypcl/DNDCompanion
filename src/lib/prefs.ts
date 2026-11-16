/**
 * Preferences (account page): the look and feel a player chooses.
 *
 * - Light, dark or the device's own (stores/mode.ts), reduced motion and the
 *   dice style apply to this device at once and are kept on it, so they
 *   work signed out and before the page has loaded (src/app.html reads them).
 * - They are also saved on the account (user metadata "prefs"), so a
 *   device that has never chosen starts with them.
 */
import { supabase } from '$lib/supabase';
import { chooseMode, choiceKept, storedChoice, type ModeChoice } from '$lib/stores/mode';

export const MOTION_KEY = 'dndcompanion:motion';
export const DICE_KEY = 'dndcompanion:dice';

/** How the dice roller shows a roll: the faces tumble, then land; or the total at once. */
export type DiceStyle = 'tumble' | 'quick';

export type Prefs = {
  mode?: ModeChoice;
  reduceMotion?: boolean;
  dice?: DiceStyle;
};

type Meta = { user_metadata?: Record<string, unknown> } | null | undefined;

export function prefsOf(user: Meta): Prefs {
  const raw = user?.user_metadata?.prefs;
  return raw && typeof raw === 'object' ? (raw as Prefs) : {};
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

export function storedReduceMotion(): boolean {
  return read(MOTION_KEY) === 'reduce';
}
export function setReduceMotion(on: boolean) {
  write(MOTION_KEY, on ? 'reduce' : 'full');
  if (typeof document === 'undefined') return;
  if (on) document.documentElement.setAttribute('data-motion', 'reduce');
  else document.documentElement.removeAttribute('data-motion');
}

export function storedDice(): DiceStyle {
  return read(DICE_KEY) === 'quick' ? 'quick' : 'tumble';
}
export function setDiceStyle(style: DiceStyle) {
  write(DICE_KEY, style);
}

/** This device's preferences as they stand now. */
export function devicePrefs(): Prefs {
  return { mode: storedChoice(), reduceMotion: storedReduceMotion(), dice: storedDice() };
}

/** Keeps a change on the account (merged into what is there). */
export async function savePrefs(user: Meta, patch: Prefs) {
  const { error } = await supabase.auth.updateUser({ data: { prefs: { ...prefsOf(user), ...patch } } });
  if (error) throw new Error(error.message);
}

/**
 * A device that has never chosen takes the account's preferences on signing
 * in; one that has keeps its own.
 */
export function adoptAccountPrefs(user: Meta) {
  const p = prefsOf(user);
  if (p.mode && !choiceKept()) chooseMode(p.mode);
  if (p.reduceMotion !== undefined && read(MOTION_KEY) === null) setReduceMotion(p.reduceMotion);
  if (p.dice && read(DICE_KEY) === null) setDiceStyle(p.dice);
}
