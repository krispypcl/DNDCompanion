import { evaluateFormula, type FormulaContext } from './formula';
import type { Tracker } from '$lib/types';

/**
 * Tracker arithmetic. A tracker's maximum may be a formula so it follows the
 * character — which means the max can shrink (a level drop, a lowered score)
 * below what is already spent. Everything here clamps rather than rendering
 * negative pips.
 */

/** The published classes, so a tracker from one the character has no levels
    in yet counts 0, while one from a feat or a species counts their level. */
const CLASSES = new Set(['artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard']);

export function trackerMax(tracker: Tracker, ctx: FormulaContext): number {
  // `classlevel` means this tracker's class, not the character's total. A
  // multiclassed Gunslinger 5 / Fighter 2 has 5 Risk Dice, not 7. A tracker
  // from a feat (Lucky) or a species has no class level: it uses the total.
  const from = tracker.class?.trim().toLowerCase() ?? '';
  const isClass = Boolean(from) && (from in (ctx.classLevels ?? {}) || CLASSES.has(from));
  const scoped = isClass ? { ...ctx, classlevel: ctx.classLevels?.[from] ?? 0 } : ctx;
  return Math.max(0, evaluateFormula(tracker.max, scoped));
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
