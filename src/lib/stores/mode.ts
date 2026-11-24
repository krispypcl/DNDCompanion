/**
 * Light or dark, chosen per device. It cannot live with the character: a
 * sheet is shared, and the mode is the reader's preference, not the owner's.
 * An account-wide setting would need the profiles table, which is phase 1b.
 *
 * The shell in src/app.html reads the same key before the first paint and
 * marks the document, so a light-mode reader never sees a dark frame first.
 * This store is only for the toggle and for keeping the two in step.
 */
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import { prefersReducedMotion } from '#lib/motion.ts';

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

/** Each mode's ground (app.css --bg), for the phone's own bars: the status bar and the browser's chrome. */
const GROUND: Record<Mode, string> = { dark: '#060607', light: '#efeff2' };

function mark(next: Mode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (next === 'light') root.setAttribute('data-mode', 'light');
  else root.removeAttribute('data-mode');
  // Safari reads the color again when the tag changes, so its bars follow the page at once.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', GROUND[next]);
}

/** Light, dark, or the device's own (account page, Preferences). */
export function chooseMode(choice: ModeChoice) {
  try {
    localStorage.setItem(MODE_KEY, choice);
  } catch {
    // A private window can refuse. The choice still applies for this visit.
  }
  modeChoice.set(choice);
  const next = choice === 'system' ? systemMode() : choice;
  crossfade(() => {
    mark(next);
    mode.set(next);
  });
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
 * Shows a mode without keeping it on the device: the Owlbear extension follows Owlbear's own
 * light or dark. Its pages share this site's storage, so keeping it there turned the app itself
 * dark on its next load, whatever had been chosen in it.
 */
export function showMode(next: Mode) {
  mark(next);
  mode.set(next);
}

/**
 * Switching light and dark by hand: the new look fades in over the old as
 * one picture (a view transition), so it costs the same on any page. Easing
 * every element's colors instead made a full campaign page stutter. The
 * page underneath switches at once (`.mode-snap` holds every element's own
 * transitions off meanwhile). Without view transitions, or with reduced
 * motion, it simply switches, as cheaply.
 */
type Transitioning = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } };
export function crossfade(apply: () => void) {
  if (typeof document === 'undefined') return apply();
  const doc = document as Transitioning;
  const root = document.documentElement;
  const reduced = prefersReducedMotion();
  root.classList.add('mode-snap');
  const done = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('mode-snap', 'mode-fade')));
  if (reduced || !doc.startViewTransition) {
    apply();
    return done();
  }
  root.classList.add('mode-fade');
  doc
    .startViewTransition(async () => {
      apply();
      // The components catch up (a frame can't be waited for here: the browser holds them back until this returns).
      await tick();
    })
    .finished.catch(() => {})
    .finally(done);
}
export function toggleMode() {
  crossfade(() =>
    mode.update((current) => {
      const next: Mode = current === 'dark' ? 'light' : 'dark';
      applyMode(next);
      return next;
    })
  );
}
