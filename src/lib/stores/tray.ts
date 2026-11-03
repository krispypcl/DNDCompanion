/**
 * What the dice tray and General actions were showing, kept while the sheet
 * is open, so switching tabs and coming back to Combat finds them as they
 * were: open if they were open, with the same dice chosen and the same rolls.
 * Not saved anywhere; a fresh visit starts folded.
 */
import { writable } from 'svelte/store';
import type { Pool, Roll } from '$lib/rules/dice';

export type TrayMemory = { open: boolean; pool: Pool; last: Roll | null; history: Roll[] };

const fresh = (): TrayMemory => ({
  open: false,
  pool: { dice: {}, modifier: 0, mode: 'normal' },
  last: null,
  history: []
});

export const trayMemory = writable<TrayMemory>(fresh());

export const actionsOpen = writable(false);
/** The Combat tab's list of the character's own options (maneuvers, feats…). */
export const featuresOpen = writable(false);

/** Another sheet opened: its tray starts folded and empty. */
export function resetTray() {
  trayMemory.set(fresh());
  actionsOpen.set(false);
  featuresOpen.set(false);
}
