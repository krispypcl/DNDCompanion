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

export const MODE_KEY = 'dndcompanion:mode';

/** Dark unless light was explicitly chosen, including when storage throws. */
export function storedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export const mode = writable<Mode>(typeof document === 'undefined' ? 'dark' : storedMode());

/** The document carries the mode; everything else reads it from there. */
export function applyMode(next: Mode) {
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {
    // A private window can refuse. The mode still applies for this visit.
  }
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (next === 'light') root.setAttribute('data-mode', 'light');
  else root.removeAttribute('data-mode');
}

export function toggleMode() {
  mode.update((current) => {
    const next: Mode = current === 'dark' ? 'light' : 'dark';
    applyMode(next);
    return next;
  });
}
