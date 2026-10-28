import { evaluateFormula, type FormulaContext } from './formula';
import type { Tracker } from '$lib/types';

/**
 * Tracker arithmetic. A tracker's maximum may be a formula so it follows the
 * character — which means the max can shrink (a level drop, a lowered score)
 * below what is already spent. Everything here clamps rather than rendering
 * negative pips.
 */

export function trackerMax(tracker: Tracker, ctx: FormulaContext): number {
  return Math.max(0, evaluateFormula(tracker.max, ctx));
}

export function clampSpent(spent: number, max: number): number {
  return Math.min(Math.max(0, spent), Math.max(0, max));
}

/** For a spend tracker this is what remains; for accrue, what has been gathered. */
export function trackerRemaining(tracker: Tracker, spent: number, ctx: FormulaContext): number {
  const max = trackerMax(tracker, ctx);
  const used = clampSpent(spent, max);
  return tracker.direction === 'accrue' ? used : max - used;
}

export function initialSpent(_tracker: Tracker, _ctx: FormulaContext): number {
  // Both directions store "how many are marked". A spend tracker starts full
  // (nothing marked); an accrue tracker starts empty (nothing marked).
  return 0;
}
