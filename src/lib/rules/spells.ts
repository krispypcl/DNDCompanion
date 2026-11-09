/**
 * Spells are listed by level: cantrips first, then each level in order, then
 * the ones with no level yet. The level is stored as text, so this reads it
 * however it was written — "Cantrip", "3", "3rd level", "Level 3" — and gives
 * anything else (an imported "Ritual") a group of its own after the levels.
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
  if (!text) return 'No level yet';
  return text[0].toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Whether a spell needs concentration, read from how its duration was
 * written: "Concentration, up to 1 minute", the short "Conc." or "Conc", a
 * lone "C" or "(C)", and any of those beside the time ("1 hr. Conc."). In the
 * notes only the clearer forms count, so "concerned" or a stray "C" doesn't.
 */
export function needsConcentration(duration: unknown, notes?: unknown): boolean {
  const d = String(duration ?? '');
  if (/\bconc/i.test(d) || /(?:^|[\s(\[,;/])c(?=$|[\s)\].,;:/])/i.test(d)) return true;
  return /\bconc(?:entrat|\.|\b)/i.test(String(notes ?? ''));
}
