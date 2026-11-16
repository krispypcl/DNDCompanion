/**
 * Light or dark, chosen per device. It cannot live with the character: a
 * sheet is shared, and the mode is the reader's preference, not the owner's.
 * An account-wide setting would need the profiles table, which is phase 1b.
 *
 * The shell in src/app.html reads the same key before the first paint and
 * marks the document, so a light-mode reader never sees a dark frame first.
 * This store is only for the toggle and for keeping the two in step.
 */
import { writable } from 'svelte/store';

export type Mode = 'dark' | 'light';
/** What was chosen: a mode, or whatever the device's own setting is. */
export type ModeChoice = Mode | 'system';

export const MODE_KEY = 'dndcompanion:mode';

/** What the device itself prefers (dark when it can't say). */
function systemMode(): Mode {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** The choice kept on this device: dark unless light or system was chosen. */
export function storedChoice(): ModeChoice {
  try {
    const kept = localStorage.getItem(MODE_KEY);
    return kept === 'light' || kept === 'system' ? kept : 'dark';
  } catch {
    return 'dark';
  }
}
/** Whether this device has ever chosen (an account's preference fills in only when not). */
export function choiceKept(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) !== null;
  } catch {
    return false;
  }
}

/** Dark unless light was chosen (or the device prefers light, under System), including when storage throws. */
export function storedMode(): Mode {
  const choice = storedChoice();
  return choice === 'system' ? systemMode() : choice;
}

export const mode = writable<Mode>(typeof document === 'undefined' ? 'dark' : storedMode());
export const modeChoice = writable<ModeChoice>(typeof document === 'undefined' ? 'dark' : storedChoice());

function mark(next: Mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (next === 'light') root.setAttribute('data-mode', 'light');
  else root.removeAttribute('data-mode');
}

/** Light, dark or the device's own (account page, Preferences). */
export function chooseMode(choice: ModeChoice) {
  try {
    localStorage.setItem(MODE_KEY, choice);
  } catch {
    // A private window can refuse. The choice still applies for this visit.
  }
  easeMode();
  modeChoice.set(choice);
  const next = choice === 'system' ? systemMode() : choice;
  mark(next);
  mode.set(next);
}

// Under System, the page follows the device as it changes (an evening switch).
if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => {
    if (storedChoice() !== 'system') return;
    const next = systemMode();
    mark(next);
    mode.set(next);
  });
}

/** The document carries the mode; everything else reads it from there. */
export function applyMode(next: Mode) {
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {
    // A private window can refuse. The mode still applies for this visit.
  }
  modeChoice.set(next);
  mark(next);
}

/**
 * Switching by hand eases the whole page across (colours fade over a third of
 * a second) instead of snapping; the class is only on for that moment, so it
 * never slows anything else down.
 */
let easing: ReturnType<typeof setTimeout> | undefined;
export function easeMode() {
  if (typeof document === 'undefined' || typeof matchMedia !== 'function') return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('mode-easing');
  clearTimeout(easing);
  easing = setTimeout(() => document.documentElement.classList.remove('mode-easing'), 450);
}
export function toggleMode() {
  easeMode();
  mode.update((current) => {
    const next: Mode = current === 'dark' ? 'light' : 'dark';
    applyMode(next);
    return next;
  });
}
