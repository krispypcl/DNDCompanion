import { evaluateFormula } from './formula';
import { formulaContext } from './derived';
import { clampSpent, trackerMax } from './tracker';
import type { Definition, RestKind, State } from '$lib/types';

/**
 * Rests are the one moment the whole sheet moves at once. Pure here so the
 * component can animate the result without owning the arithmetic.
 *
 * A long rest subsumes short and dawn: a night's sleep passes a dawn.
 */
const REFILLED_BY: Record<RestKind, RestKind[]> = {
  short: ['short'],
  long: ['short', 'long', 'dawn'],
  dawn: ['dawn']
};

export function applyRest(def: Definition, state: State, kind: RestKind): State {
  const ctx = formulaContext(def);
  const refills = REFILLED_BY[kind];
  const trackers = { ...state.trackers };

  for (const tracker of def.trackers ?? []) {
    if (tracker.reset.on === 'manual') continue;
    if (!refills.includes(tracker.reset.on)) continue;

    const marked = trackers[tracker.id] ?? 0;

    if (tracker.reset.amount === 'full') {
      trackers[tracker.id] = 0;
      continue;
    }

    let restored: number;
    try {
      restored = evaluateFormula(tracker.reset.amount, ctx);
    } catch {
      // A broken formula must not silently wipe or inflate a resource.
      continue;
    }

    let max: number;
    try {
      max = trackerMax(tracker, ctx);
    } catch {
      continue;
    }

    trackers[tracker.id] = clampSpent(marked - Math.max(0, restored), max);
  }

  if (kind !== 'long') return { ...state, trackers };

  // A long rest restores all hit points and half your total hit dice,
  // rounded down, minimum one.
  const total = Number.parseInt(def.combat?.hitDice ?? '0', 10) || 0;
  const regained = Math.max(1, Math.floor(total / 2));

  return {
    ...state,
    trackers,
    hpCurrent: def.combat?.hpMax ?? state.hpCurrent,
    hpTemp: 0,
    hitDiceUsed: Math.max(0, state.hitDiceUsed - regained),
    deathSaves: { successes: 0, failures: 0 }
  };
}
