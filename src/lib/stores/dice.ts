/**
 * A roll asked for from elsewhere on the sheet — an attack's hit or damage,
 * a skill — for the dice tray to make. The tray is the only listener, and it
 * takes the request off the store when it makes the roll, so a tray that
 * appears later (switching back to the Combat tab) does not roll it again.
 */
import { get, writable } from 'svelte/store';
import type { Pool, Roll } from '$lib/rules/dice';

/** mode: 'keep' leaves the tray's advantage as chosen, 'normal' rolls plainly,
    'pool' rolls as the pool says (a save with advantage from a feature).
    `then` hears the result, for a roll that does something (a short rest healing). */
export type DiceRequest = { pool: Pool; label: string; id: number; then?: (result: Roll) => void; mode?: 'keep' | 'normal' | 'pool' };

let next = 0;
export const diceRequest = writable<DiceRequest | null>(null);

/**
 * What the open sheet takes from every d20 test it asks for (exhaustion's
 * 2 a level), and why; set by the sheet, cleared when it closes. Rolls
 * without a d20 (damage, a tracker's die) are left alone.
 */
export const d20Penalty = writable<{ amount: number; why: string } | null>(null);

export function requestRoll(pool: Pool, label: string, then?: (result: Roll) => void, mode: 'keep' | 'normal' | 'pool' = 'keep') {
  next += 1;
  const penalty = get(d20Penalty);
  if (penalty && penalty.amount > 0 && (pool.dice[20] ?? 0) > 0) {
    pool = { ...pool, modifier: pool.modifier - penalty.amount };
    label = `${label} (${penalty.why} −${penalty.amount})`;
  }
  diceRequest.set({ pool, label, id: next, then, mode });
}

/** Called by the tray once it has made the roll. */
export function takeRoll(id: number) {
  diceRequest.update((req) => (req && req.id === id ? null : req));
}
