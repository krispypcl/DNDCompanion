/**
 * Links to an entry on 5e.tools.
 *
 * Every link goes through 5e.tools' own search, with its "lucky" switch,
 * which opens the best match directly:
 *
 *   https://5e.tools/search.html?q=<name> in:<category> source:<source>&lucky
 *
 * A page link (spells.html#fireball_xphb) has to match the entry's name and
 * book exactly and lives on a page that depends on what the entry is; a class
 * feature like Second Wind is not on the feats page at all. The search
 * forgives all of that: it matches the name loosely, narrows by category and
 * book when they are known, and still finds something when the book is not.
 *
 * Before searching, the name is stripped of what is the player's and not the
 * book's: "(+1)", "+2", "x3", "[attuned]".
 */

export const LOOKUP_BASE = 'https://5e.tools';

export type LookupCategory =
  | 'spells'
  | 'items'
  | 'races'
  | 'feats'
  | 'backgrounds'
  | 'classes'
  /** A subclass opens on its class's page with the subclass already chosen. */
  | 'subclasses'
  | 'conditionsdiseases'
  /** Anything: a tracker, or a feature that may be a feat or a class feature. */
  | 'any';

/** 5e.tools search's own category words. A feature may be a feat, a class
    feature or an optional feature, so it is not narrowed. */
const IN_CATEGORY: Record<LookupCategory, string | null> = {
  spells: 'sp',
  items: 'itm',
  races: 'species',
  feats: null,
  backgrounds: 'bg',
  classes: 'class',
  subclasses: 'subclass',
  conditionsdiseases: 'con',
  any: null
};

/** Sources that describe content with no page to link to. */
const UNLINKABLE = new Set(['homebrew', 'custom', 'none']);

/** The name as the book has it: no bonuses, counts or notes in brackets. */
export function lookupName(name: string): string {
  return name
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ')
    .replace(/(^|\s)[+-]\s?\d+(?=\s|$)/g, ' ')
    .replace(/(^|\s)[x×]\s?\d+(?=\s|$)/gi, ' ')
    .replace(/(^|\s)\d+\s?[x×](?=\s|$)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,;:–—-]+$/, '')
    .trim();
}

export function lookupUrl(
  name: string,
  source: string | undefined,
  category: LookupCategory,
  override?: string
): string | null {
  if (override?.trim()) return override.trim();

  const src = source?.trim().toLowerCase();
  if (src && UNLINKABLE.has(src)) return null;
  const clean = lookupName(name ?? '');
  if (!clean) return null;

  const parts = [clean];
  const cat = IN_CATEGORY[category];
  if (cat) parts.push(`in:${cat}`);
  // Last: 5e.tools reads everything after "source:" as the source.
  if (src) parts.push(`source:${src}`);
  return `${LOOKUP_BASE}/search.html?q=${encodeURIComponent(parts.join(' '))}&lucky`;
}

/** True when the entry should show a "Homebrew" tag rather than a link. */
export function isHomebrew(source: string | undefined): boolean {
  const src = source?.trim().toLowerCase();
  return Boolean(src && UNLINKABLE.has(src));
}
