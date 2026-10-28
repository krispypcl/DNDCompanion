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
