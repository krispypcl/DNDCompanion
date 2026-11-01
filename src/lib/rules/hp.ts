import type { State } from '$lib/types';

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
