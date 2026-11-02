/**
 * Links to an entry on 5e.tools, two ways.
 *
 * With a book (source) and a page that is certain — spells, items, species,
 * backgrounds, classes and subclasses, conditions — the link goes straight
 * to the entry, built the way 5e.tools builds its own:
 *
 *   https://5e.tools/races.html#tiefling%20(glasya)_mtf
 *
 * Otherwise it goes through 5e.tools' search with its "lucky" switch, which
 * opens the best match: for an entry with no book written, and for features,
 * which may be feats or class features on different pages.
 *
 *   https://5e.tools/search.html?q=<name> in:<category> source:<source>&lucky
 *
 * The search leaves out "legacy" books (the 2014 Player's Handbook, Mordenkainen's
 * Tome of Foes and the rest) unless a reader has switched them on, which is
 * why anything with a book written gets the direct link.
 *
 * Either way the name is first stripped of what is the player's and not the
 * book's: "(+1)", "+2", "x3", "[attuned]".
 */

import BREW_SOURCES from '$lib/data/brew-sources.json';

export const LOOKUP_BASE = 'https://5e.tools';

/**
 * The source as 5e.tools' links spell it. 5e.tools shows a homebrew book by
 * its abbreviation ("GC:VSS'24") but links by its id ("valdagunslinger"), so
 * a source copied off the page is translated. The table is generated from
 * the homebrew repository by `npm run brew-sources`.
 */
export function sourceId(source: string): string {
  const key = source.trim().toLowerCase();
  return (BREW_SOURCES as Record<string, string>)[key] ?? key;
}

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

/** The page each kind of entry lives on, where that is certain. */
const PAGE: Partial<Record<LookupCategory, string>> = {
  spells: 'spells.html',
  items: 'items.html',
  races: 'races.html',
  backgrounds: 'backgrounds.html',
  classes: 'classes.html',
  conditionsdiseases: 'conditionsdiseases.html'
};

/** 5e.tools' own hash encoding: lower case, URI-encoded, lower case again. */
const hashPart = (s: string) => encodeURIComponent(s.toLowerCase()).toLowerCase();

/** Sources that describe content with no page to link to. */
const UNLINKABLE = new Set(['homebrew', 'custom', 'none']);

/** Where the books themselves name a variant in brackets: "Tiefling
    (Glasya)", "Elf (High)", "Dragonborn (Gold)". There, a bracket is part of
    the name and stays — unless it holds a number, which is the player's. */
const NAMED_VARIANTS = new Set<LookupCategory>(['races', 'classes', 'subclasses', 'backgrounds']);

/** The name as the book has it: no bonuses, counts or notes in brackets. */
export function lookupName(name: string, category: LookupCategory = 'any'): string {
  const keepWords = NAMED_VARIANTS.has(category);
  return name
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, (group) => (keepWords && !/[\d+\-−×]/.test(group) ? group : ' '))
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
  override?: string,
  /** For a subclass: its class, and the class's book. */
  parent?: { name: string; source?: string }
): string | null {
  if (override?.trim()) return override.trim();

  const written = source?.trim().toLowerCase();
  if (written && UNLINKABLE.has(written)) return null;
  const src = written ? sourceId(written) : written;
  const clean = lookupName(name ?? '', category);
  if (!clean) return null;

  if (src) {
    const page = PAGE[category];
    if (page) return `${LOOKUP_BASE}/${page}#${hashPart(clean)}_${hashPart(src)}`;
    // A subclass is its class's page, with the subclass chosen.
    const parentName = parent ? lookupName(parent.name, 'classes') : '';
    if (category === 'subclasses' && parentName) {
      const parentSrc = parent?.source?.trim() ? sourceId(parent.source) : src;
      return `${LOOKUP_BASE}/classes.html#${hashPart(parentName)}_${hashPart(parentSrc)},state:sub_${hashPart(clean)}_${hashPart(src)}=b1`;
    }
  }

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
