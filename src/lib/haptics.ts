/**
 * Haptics: a phone's buzz for the moments that are the player's own, felt
 * as well as heard (a hit taken, a natural 20, a death save, their turn, a
 * card picked up, pull to refresh). Only on a touch screen, and only where
 * the browser can vibrate (iPhones' browsers can't, so there it is silent).
 * Short, and stronger for what matters more; never for what happens to
 * someone else at the table.
 */

/** Each moment's pattern: milliseconds of buzz, then of rest, and so on. */
const FEELS = {
  /** A light tick: a long press taking hold, a pull past its point, a die landing. */
  tick: 8,
  /** Lighter still: going back under that point. */
  untick: 5,
  pickUp: 8,
  drop: 6,
  heal: [8, 40, 8],
  shield: [6, 30, 12],
  crit: [20, 40, 20, 40, 45],
  fumble: 60,
  save: 12,
  fail: 40,
  down: [60, 80, 30],
  death: [80, 60, 140],
  yourTurn: [30, 60, 30],
  call: [25, 50, 25, 50, 40],
  levelUp: [15, 30, 15, 30, 40],
  success: 10,
  error: [20, 40, 20],
  refresh: 18
} as const satisfies Record<string, number | readonly number[]>;
export type Feel = keyof typeof FEELS | 'hit';

const touch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Felt, where the phone can: `hit` is as strong as the blow (severity 0 to 1). */
export function feel(name: Feel, severity = 0.4) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function' || !touch()) return;
  const pattern = name === 'hit' ? Math.round(12 + Math.max(0, Math.min(1, severity)) * 48) : FEELS[name];
  try {
    navigator.vibrate(pattern as number | number[]);
  } catch {
    // Not allowed here (some browsers want a tap on the page first).
  }
}
