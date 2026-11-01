/**
 * Spells are listed by type: cantrips first, then each level in order, then
 * anything else that was written — "Ritual", "Innate", "Item" — each as a
 * group of its own, then the ones with nothing written yet.
 *
 * The type is free text, so this copes with whatever was typed: "Cantrip",
 * "3", "3rd level", "Level 3", "3rd-level spell", or a word of the player's own.
 */

/** Spells with no type yet go last, after every real one. */
export const UNLEVELLED = 99;
/** Anything that is not a level sits between the levels and the untyped. */
export const CUSTOM = 50;

const ORDINAL = ['th', 'st', 'nd', 'rd'];

export function ordinal(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${ORDINAL[n % 10] ?? 'th'}`;
}

/** What the type field suggests. Anything else may still be typed. */
export const SPELL_TYPES = ['Cantrip', ...Array.from({ length: 10 }, (_, i) => `${ordinal(i + 1)} level`)];

/** The level a type names, 0 for a cantrip, or null for anything else. */
export function spellLevel(type: unknown): number | null {
  const text = String(type ?? '').trim().toLowerCase();
  if (!text) return null;
  if (/^cantrips?$/.test(text) || text === '0' || text === 'level 0') return 0;
  const m =
    text.match(/^(\d{1,2})$/) ??
    text.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]*(?:level|lvl)(?:[\s-]*spells?)?$/) ??
    text.match(/^(?:level|lvl)[\s-]*(\d{1,2})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n < CUSTOM ? n : null;
}

export function spellRank(type: unknown): number {
  const level = spellLevel(type);
  if (level !== null) return level;
  return String(type ?? '').trim() ? CUSTOM : UNLEVELLED;
}

/** The group a spell is listed under. Custom types are grouped regardless of case. */
export function spellGroup(type: unknown): string {
  const level = spellLevel(type);
  if (level === 0) return 'Cantrips';
  if (level !== null) return `${ordinal(level)} level`;
  const text = String(type ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return 'No type yet';
  return text[0].toUpperCase() + text.slice(1).toLowerCase();
}

/** How a type reads in the table: a bare "3" from before is shown as "3rd level". */
export function spellTypeLabel(type: unknown): string {
  const level = spellLevel(type);
  if (level === 0) return 'Cantrip';
  if (level !== null) return `${ordinal(level)} level`;
  return String(type ?? '').trim();
}
