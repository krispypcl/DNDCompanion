/**
 * A roll asked for from elsewhere on the sheet — an attack's hit or damage —
 * for the dice tray to make. The tray is the only listener.
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
