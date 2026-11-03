/**
 * Conditions and effects on a character: the standard conditions, and anything
 * else a table tracks the same way ("Bless", "Hunter's Mark", "On fire").
 *
 * They are only names. What a condition does is left to the people at the
 * table, the same as everywhere else on the sheet; the list below exists so
 * the common ones are one pick away, not so the app can apply them.
 */
import type { ConditionLook, State } from '$lib/types';

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
  'Unconscious',
  /** Not a rule's condition but the table's: three failed death saves. */
  'Dead'
] as const;

/** Standard conditions with no page of their own on 5e.tools. */
const NO_PAGE = new Set(['dead']);

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
  if (match && NO_PAGE.has(key(match))) return null;
  return match ? `https://5e.tools/conditionsdiseases.html#${match.toLowerCase()}_xphb` : null;
}

/**
 * The screen tint for each standard condition: a colour and how it moves.
 * Dead has one too. A condition written in by hand gets whatever its owner
 * chose for it, kept on the sheet in `conditionLooks`.
 */
const STANDARD_LOOKS: Record<string, ConditionLook> = {
  blinded: { color: 'oklch(14% 0.005 286)', motion: 'heavy' },
  charmed: { color: 'oklch(68% 0.2 350)', motion: 'pulse' },
  deafened: { color: 'oklch(58% 0.06 245)', motion: 'still' },
  exhaustion: { color: 'oklch(52% 0.08 60)', motion: 'heavy' },
  frightened: { color: 'oklch(45% 0.18 300)', motion: 'shiver' },
  grappled: { color: 'oklch(64% 0.16 50)', motion: 'still' },
  incapacitated: { color: 'oklch(58% 0.01 286)', motion: 'still' },
  invisible: { color: 'oklch(86% 0.08 210)', motion: 'shimmer' },
  paralyzed: { color: 'oklch(76% 0.12 230)', motion: 'still' },
  petrified: { color: 'oklch(62% 0.025 80)', motion: 'still' },
  poisoned: { color: 'oklch(66% 0.19 140)', motion: 'pulse' },
  prone: { color: 'oklch(50% 0.07 50)', motion: 'still' },
  restrained: { color: 'oklch(70% 0.14 75)', motion: 'still' },
  stunned: { color: 'oklch(88% 0.17 95)', motion: 'daze' },
  unconscious: { color: 'oklch(28% 0.08 265)', motion: 'heavy' },
  dead: { color: 'oklch(16% 0.04 25)', motion: 'heavy' }
};

/** "Exhaustion 2" is exhaustion; case and spacing do not matter. */
export const lookKey = (name: string) => key(name).replace(/\s*\d+$/, '');

export function isStandard(name: string): boolean {
  return lookKey(name) in STANDARD_LOOKS;
}

/** The tint for a condition, or null for one with none. */
export function lookOf(name: string, custom: Record<string, ConditionLook> = {}): ConditionLook | null {
  const k = lookKey(name);
  const look = STANDARD_LOOKS[k] ?? custom[k];
  return look && look.color ? look : null;
}
