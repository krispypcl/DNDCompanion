/**
 * A roll asked for from elsewhere on the sheet — an attack's hit or damage,
 * a skill — for the dice tray to make. The tray is the only listener, and it
 * takes the request off the store when it makes the roll, so a tray that
 * appears later (switching back to the Combat tab) does not roll it again.
 */
import { writable } from 'svelte/store';
import type { Pool } from '$lib/rules/dice';

export type DiceRequest = { pool: Pool; label: string; id: number };

let next = 0;
export const diceRequest = writable<DiceRequest | null>(null);

export function requestRoll(pool: Pool, label: string) {
  next += 1;
  diceRequest.set({ pool, label, id: next });
}

/** Called by the tray once it has made the roll. */
export function takeRoll(id: number) {
  diceRequest.update((req) => (req && req.id === id ? null : req));
}
