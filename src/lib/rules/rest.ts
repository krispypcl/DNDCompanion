import { evaluateFormula } from './formula';
import { formulaContext, modifierOf } from './derived';
import type { Pool } from './dice';
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

/**
 * The character's hit dice, from "7d10" or "5d10 + 2d8" (a bare count is
 * taken as d8s). Largest first: those are the ones spent first.
 */
export function hitDiceOf(def: Definition): { sides: number; count: number }[] {
  const raw = String(def.combat?.hitDice ?? '').toLowerCase();
  const out: { sides: number; count: number }[] = [];
  for (const m of raw.matchAll(/(\d*)\s*d\s*(\d+)/g)) {
    const count = m[1] ? Number(m[1]) : 1;
    const sides = Number(m[2]);
    if (count > 0 && [4, 6, 8, 10, 12, 20].includes(sides)) out.push({ sides, count });
  }
  if (!out.length) {
    const n = Number.parseInt(raw, 10);
    if (n > 0) out.push({ sides: 8, count: n });
  }
  return out.sort((a, b) => b.sides - a.sides);
}

/** How many hit dice are left to spend. */
export function hitDiceLeft(def: Definition, state: State): number {
  const total = hitDiceOf(def).reduce((sum, d) => sum + d.count, 0);
  return Math.max(0, total - (state.hitDiceUsed ?? 0));
}

/**
 * Spending hit dice on a short rest: that many of the character's dice, each
 * with the Constitution modifier. (The largest still unspent come first.)
 */
export function hitDicePool(def: Definition, state: State, count: number): Pool | null {
  let skip = state.hitDiceUsed ?? 0;
  let want = Math.min(count, hitDiceLeft(def, state));
  if (want <= 0) return null;
  const dice: Pool['dice'] = {};
  const used = want;
  for (const d of hitDiceOf(def)) {
    const fromHere = Math.max(0, d.count - skip);
    skip = Math.max(0, skip - d.count);
    const take = Math.min(fromHere, want);
    if (take > 0) {
      dice[d.sides as keyof Pool['dice']] = (dice[d.sides as keyof Pool['dice']] ?? 0) + take;
      want -= take;
    }
  }
  return { dice, modifier: modifierOf(def, 'con') * used, mode: 'normal' };
}

/** What spent hit dice give back: the roll, never less than nothing, up to full. */
export function healFromHitDice(def: Definition, state: State, spent: number, total: number): State {
  const max = Number(def.combat?.hpMax) || state.hpCurrent;
  return {
    ...state,
    hpCurrent: Math.min(max, (state.hpCurrent ?? 0) + Math.max(0, total)),
    hitDiceUsed: (state.hitDiceUsed ?? 0) + spent
  };
}
