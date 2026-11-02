import type { State } from '$lib/types';
import { addCondition, hasCondition, removeCondition } from './conditions';

/**
 * Hit point arithmetic, kept pure and apart from the component so the edges
 * — overkill damage, overheal, temp HP absorbing first — are testable.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function applyDamage(state: State, amount: number, hpMax: number): State {
  if (amount <= 0) return state;

  const fromTemp = Math.min(state.hpTemp, amount);
  const remainder = amount - fromTemp;

  return {
    ...state,
    hpTemp: state.hpTemp - fromTemp,
    hpCurrent: clamp(state.hpCurrent - remainder, 0, hpMax)
  };
}

export function applyHealing(state: State, amount: number, hpMax: number): State {
  if (amount <= 0) return state;
  return {
    ...state,
    hpCurrent: clamp(state.hpCurrent + amount, 0, hpMax),
    // Any healing brings you back up; the count starts fresh next time.
    deathSaves: { successes: 0, failures: 0 }
  };
}

/** Temporary hit points never stack — the larger pool replaces the smaller. */
export function setTempHp(state: State, amount: number): State {
  return { ...state, hpTemp: Math.max(state.hpTemp, Math.max(0, amount)) };
}

export function setDeathSave(
  state: State,
  kind: 'successes' | 'failures',
  count: number
): State {
  return { ...state, deathSaves: { ...state.deathSaves, [kind]: clamp(count, 0, 3) } };
}

/**
 * How hurt a character looks, from 0 (fine) to 1 (at zero hit points). It
 * begins below half health and grows from there, so the screen starts to
 * show it at the same moment the number turns red.
 */
export function hurtLevel(current: number, max: number): number {
  if (!(max > 0)) return 0;
  const ratio = clamp(current / max, 0, 1);
  return ratio < 0.5 ? clamp((0.5 - ratio) / 0.5, 0, 1) : 0;
}

/**
 * How hard a hit landed, from 0 to 1: the share of the maximum it took. A
 * 3-point scratch on a 90-point character and a 45-point blow should not
 * move the gauge the same way.
 */
export function hitSeverity(lost: number, max: number): number {
  if (!(max > 0) || !(lost > 0)) return 0;
  // Half the maximum in one hit is as hard as the gauge ever shakes.
  return clamp(lost / (max * 0.5), 0, 1);
}

export type Vital = 'healthy' | 'bloodied' | 'critical' | 'down' | 'stable' | 'dead';

/**
 * One word for how the character is doing, for whoever is looking at the
 * sheet. Bloodied is the table's own word for half health or less; critical
 * is a quarter or less. At zero, three successes is stable and three
 * failures is dead.
 */
export function vitalStatus(
  current: number,
  max: number,
  saves: { successes: number; failures: number } = { successes: 0, failures: 0 }
): { vital: Vital; label: string } {
  if (current <= 0 && max > 0) {
    if (saves.failures >= 3) return { vital: 'dead', label: 'Dead' };
    if (saves.successes >= 3) return { vital: 'stable', label: 'Stable' };
    return { vital: 'down', label: 'Down' };
  }
  const ratio = max > 0 ? current / max : 1;
  if (ratio <= 0.25) return { vital: 'critical', label: 'Critical' };
  if (ratio <= 0.5) return { vital: 'bloodied', label: 'Bloodied' };
  return { vital: 'healthy', label: 'Healthy' };
}

export const DOWNED = 'Incapacitated';
export const DEAD = 'Dead';

/**
 * What follows on its own from a change to hit points or death saves:
 *
 * - dropping to 0 adds Incapacitated;
 * - coming back above 0 takes Incapacitated and Dead away again;
 * - a third successful death save brings the character back to 1 hit point;
 * - a third failed one adds Dead, and taking that failure back removes it.
 *
 * Given the state before and after, it returns the state after with these
 * applied. With no maximum written, nothing is decided.
 */
export function withVitals(before: State, after: State, hpMax: number): State {
  if (!(hpMax > 0)) return after;
  let next = after;
  const wasDown = before.hpCurrent <= 0;
  const isDown = next.hpCurrent <= 0;
  const saves = next.deathSaves ?? { successes: 0, failures: 0 };
  const savedBefore = before.deathSaves?.successes ?? 0;
  const failedBefore = before.deathSaves?.failures ?? 0;

  if (isDown && saves.successes >= 3 && savedBefore < 3 && saves.failures < 3) {
    // Back on their feet, if only just.
    next = { ...next, hpCurrent: 1, deathSaves: { successes: 0, failures: 0 } };
    next = removeCondition(next, DOWNED);
    return next;
  }
  if (isDown && !wasDown) next = addCondition(next, DOWNED);
  if (!isDown && wasDown) next = removeCondition(removeCondition(next, DOWNED), DEAD);
  if (isDown && saves.failures >= 3 && failedBefore < 3) next = addCondition(next, DEAD);
  if (isDown && saves.failures < 3 && failedBefore >= 3 && hasCondition(next, DEAD)) next = removeCondition(next, DEAD);
  return next;
}

/** Dead by the saves or by the condition, whichever was written. */
export function isDead(state: State): boolean {
  return (state.deathSaves?.failures ?? 0) >= 3 || hasCondition(state, DEAD);
}
