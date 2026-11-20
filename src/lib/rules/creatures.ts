/**
 * Monsters and NPCs the DM keeps on the campaign page: their hit points
 * as they take damage and heal, numbering a group of the same creature,
 * and where to read about one on 5e.tools.
 */
import { LOOKUP_BASE } from './lookup';

/** Faces the DM can pick for a creature (or write their own): calm to about to flee. */
export const EXPRESSIONS = [
  'Calm', 'Curious', 'Wary', 'Smug', 'Grinning', 'Snarling', 'Furious', 'Pained', 'Frightened', 'Desperate', 'Pleading', 'About to flee'
] as const;
/** A face as written: trimmed, one line, at most 40 characters (database/0023). */
export const cleanExpression = (s: string) => s.replace(/\s+/g, ' ').trim().slice(0, 40);

export type CreatureKind = 'monster' | 'npc';
type Hp = { hp_max: number | null; hp_current: number | null; hp_temp: number };

/** Hit points now: those written, or full when none are. */
export const hpNow = (c: Hp) => c.hp_current ?? c.hp_max ?? 0;

/** Damage comes off temporary hit points first, then the rest, down to 0. */
export function damage(c: Hp, amount: number): Pick<Hp, 'hp_current' | 'hp_temp'> {
  const n = Math.max(0, Math.floor(amount));
  const fromTemp = Math.min(c.hp_temp, n);
  return { hp_temp: c.hp_temp - fromTemp, hp_current: Math.max(0, hpNow(c) - (n - fromTemp)) };
}

/** Healing, up to the most it can have (when that is known). */
export function heal(c: Hp, amount: number): Pick<Hp, 'hp_current'> {
  const n = Math.max(0, Math.floor(amount));
  const up = hpNow(c) + n;
  return { hp_current: c.hp_max === null ? up : Math.min(c.hp_max, up) };
}

/** "Goblin 3" is a Goblin: the name without the number a group gave it. */
export const baseName = (name: string) => name.trim().replace(/\s+\d+$/, '');

/**
 * Names for `count` more of a creature: alone, its name as it is; in a
 * group, numbered on from any already at the table ("Goblin 4", "Goblin 5").
 */
export function numberedNames(name: string, count: number, existing: string[]): string[] {
  const base = baseName(name);
  const n = Math.max(1, Math.min(20, Math.floor(count)));
  const same = existing.map((e) => e.trim()).filter((e) => baseName(e).toLowerCase() === base.toLowerCase());
  if (n === 1 && !same.length) return [name.trim()];
  const highest = same.reduce((m, e) => Math.max(m, Number(/\s(\d+)$/.exec(e)?.[1] ?? 0)), 0);
  return Array.from({ length: n }, (_, i) => `${base} ${highest + i + 1}`);
}

/** Where to read about it: the DM's own link, or 5e.tools' search for its name. */
export function creatureUrl(name: string, link: string): string {
  if (link.trim()) return link.trim();
  return `${LOOKUP_BASE}/search.html?q=${encodeURIComponent(baseName(name))}`;
}
