/**
 * Spells are listed by level, cantrips first. A level is written text — a
 * homebrew tenth level is not a schema change — so the order has to cope with
 * whatever was typed: "Cantrip", "3", " 3 ", "cantrip", or nothing yet.
 */

/** Spells with no level yet go last, after every real one. */
export const UNLEVELLED = 99;

export function spellRank(level: unknown): number {
  const text = String(level ?? '').trim().toLowerCase();
  if (text === 'cantrip' || text === '0') return 0;
  const n = Number(text);
  return Number.isInteger(n) && n > 0 && n < UNLEVELLED ? n : UNLEVELLED;
}

const ORDINAL = ['th', 'st', 'nd', 'rd'];

function ordinal(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) return `${n}th`;
  return `${n}${ORDINAL[n % 10] ?? 'th'}`;
}

export function spellGroupTitle(rank: number): string {
  if (rank === 0) return 'Cantrips';
  if (rank >= UNLEVELLED) return 'No level yet';
  return `${ordinal(rank)} level`;
}
