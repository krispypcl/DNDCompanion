/**
 * Exhaustion, by the 2024 rules: each level takes 2 from every d20 test
 * (ability checks, attack rolls and saving throws) and 5 feet from Speed;
 * a sixth level is death. A long rest removes one level.
 *
 * The level is read from the Exhaustion tracker when the sheet has one (its
 * pips count the levels), otherwise from an "Exhaustion 3" condition.
 */
import type { Definition, State, Tracker } from '$lib/types';

export const EXHAUSTION = 'Exhaustion';
export const MAX_EXHAUSTION = 6;

const isExhaustion = (name: string) => /^\s*exhaustion\b/i.test(name);

/** The Exhaustion tracker on a sheet, if it has one. */
export function exhaustionTracker(def: Definition | null | undefined): Tracker | undefined {
  return def?.trackers?.find((t) => isExhaustion(t.label));
}

/** The level from a condition chip: "Exhaustion 3" is 3; a bare "Exhaustion" is 1. */
function fromConditions(conditions: string[] = []): number {
  for (const c of conditions) {
    if (!isExhaustion(c)) continue;
    const n = Number(c.match(/(\d+)\s*$/)?.[1] ?? 1);
    return Math.max(0, Math.min(MAX_EXHAUSTION, n));
  }
  return 0;
}

export function exhaustionLevel(def: Definition | null | undefined, state: State | null | undefined): number {
  const tracker = exhaustionTracker(def);
  if (tracker) return Math.max(0, Math.min(MAX_EXHAUSTION, Number(state?.trackers?.[tracker.id]) || 0));
  return fromConditions(state?.conditions);
}

/** What exhaustion takes from every d20 test. */
export const d20Penalty = (level: number) => 2 * Math.max(0, level);

/** What it takes from Speed, in feet. */
export const speedPenalty = (level: number) => 5 * Math.max(0, level);

/**
 * The condition chips to go with a level: one "Exhaustion N" chip (none at
 * 0), and Dead at the sixth level. Other chips are left as they are, in
 * their places.
 */
export function conditionsFor(conditions: string[], level: number, dead = 'Dead'): string[] {
  const chip = level > 0 ? `${EXHAUSTION} ${level}` : null;
  const at = conditions.findIndex(isExhaustion);
  let next = conditions.filter((c) => !isExhaustion(c));
  if (chip) next.splice(at < 0 ? next.length : at, 0, chip);
  if (level >= MAX_EXHAUSTION && !next.some((c) => c.trim().toLowerCase() === dead.toLowerCase())) next = [...next, dead];
  return next;
}
