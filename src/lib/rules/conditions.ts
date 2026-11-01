/**
 * Conditions and effects on a character: the standard conditions, and anything
 * else a table tracks the same way ("Bless", "Hunter's Mark", "On fire").
 *
 * They are only names. What a condition does is left to the people at the
 * table, the same as everywhere else on the sheet; the list below exists so
 * the common ones are one pick away, not so the app can apply them.
 */
import type { State } from '$lib/types';

export const STANDARD_CONDITIONS = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Exhaustion',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious'
] as const;

/** Names are compared as written, minus case and stray spaces. */
const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

export function hasCondition(state: State, name: string): boolean {
  return (state.conditions ?? []).some((c) => key(c) === key(name));
}

/** A blank name, or one already present, changes nothing. */
export function addCondition(state: State, name: string): State {
  const clean = cleanName(name);
  if (!clean || hasCondition(state, clean)) return state;
  return { ...state, conditions: [...(state.conditions ?? []), clean] };
}

export function removeCondition(state: State, name: string): State {
  return { ...state, conditions: (state.conditions ?? []).filter((c) => key(c) !== key(name)) };
}

/**
 * The 5e.tools page for a standard condition. Anything else has no page, and
 * no link is better than one that lands on nothing.
 */
export function conditionUrl(name: string): string | null {
  const match = STANDARD_CONDITIONS.find((c) => key(c) === key(name.replace(/\s*\d+$/, '')));
  return match ? `https://5e.tools/conditionsdiseases.html#${match.toLowerCase()}_xphb` : null;
}
