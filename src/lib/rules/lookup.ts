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
import SUBCLASS_SHORT from '$lib/data/subclass-short.json';
import CLASS_FEATURES from '$lib/data/class-features.json';

const LOOKUP_BASE = 'https://5e.tools';

/**
 * The source as 5e.tools' links spell it. 5e.tools shows a homebrew book by
 * its abbreviation ("GC:VSS'24") but links by its id ("valdagunslinger"), so
 * a source copied off the page is translated. The table is generated from
 * the homebrew repository by `npm run brew-sources`.
 */
export function sourceId(source: string): string {
  const key = source.trim().toLowerCase();
  const brew = (BREW_SOURCES as Record<string, string>)[key];
  if (brew) return brew;
  return BOOK_ALIASES[key.replace(/[^a-z0-9]/g, '')] ?? key;
}

/**
 * The 2024 core books as players and other sites write them: "PHB'24",
 * "PHB 2024", "Player's Handbook (2024)". 5e.tools calls them XPHB, XDMG and
 * XMM. The 2014 books, and a few others, by their full names.
 */
const BOOK_ALIASES: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  const books: [string[], string][] = [
    [['phb', 'playershandbook'], 'phb'],
    [['dmg', 'dungeonmastersguide'], 'dmg'],
    [['mm', 'monstermanual'], 'mm']
  ];
  for (const [names, id] of books) {
    for (const n of names) {
      for (const year of ['24', '2024']) {
        out[`${n}${year}`] = `x${id}`;
        out[`${year}${n}`] = `x${id}`;
      }
      if (n.length > 3) out[n] = id;
    }
  }
  Object.assign(out, {
    xanathars: 'xge', xanathersguidetoeverything: 'xge', xanatharsguidetoeverything: 'xge',
    tashas: 'tce', tashascauldronofeverything: 'tce',
    mordenkainensmonstersofthemultiverse: 'mpmm', volosguidetomonsters: 'vgm',
    swordcoastadventurersguide: 'scag', fizbansreasuryofdragons: 'ftd', fizbanstreasuryofdragons: 'ftd'
  });
  return out;
})();

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

/** A bracket with a bonus or a multiplier in it: "(+1)", "(+1 CHA)", "(x3)". */
const BONUS = /[+\-−]\s?\d|(?:^|[\s(])[x×]\s?\d|\d\s?[x×](?:$|[\s)])/i;

/**
 * The name as the book has it. Checked against every spell, item, species,
 * background, feat and class on 5e.tools: the books' own brackets stay
 * ("Tiefling (Glasya)", "Potion of Healing (Greater)", "Arrows (20)"), and
 * so does the "+1" that starts a magic item's name ("+1 Longsword"). What
 * goes is the player's: notes in square or curly brackets, and a bonus or
 * multiplier in brackets or at the end ("Revolver (+1)", "Arrows x20").
 */
export function lookupName(name: string, category: LookupCategory = 'any'): string {
  let s = name.trim().replace(/\[[^\]]*\]|\{[^}]*\}/g, ' ');
  s = s.replace(/\([^)]*\)/g, (group) => (BONUS.test(group) ? ' ' : group));
  s = s.replace(/\s+(?:[+\-−]\s?\d+|[x×]\s?\d+|\d+\s?[x×])\s*$/i, '');
  s = s.replace(/^\s*\d+\s?[x×]\s+/i, '');
  if (category !== 'items') s = s.replace(/^\s*[+\-−]\d+\s+/, '');
  return s.replace(/\s+/g, ' ').trim().replace(/[,;:–—-]+$/, '').trim();
}

/** "Path of the Berserker" is "Berserker" in a 5e.tools link. */
function subclassShortName(name: string): string {
  const key = name.trim().toLowerCase();
  return (SUBCLASS_SHORT as Record<string, string>)[key] ?? key;
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
      return `${LOOKUP_BASE}/classes.html#${hashPart(parentName)}_${hashPart(parentSrc)},state:sub_${hashPart(subclassShortName(clean))}_${hashPart(src)}=b1`;
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


const FEATURES = CLASS_FEATURES as {
  classes: Record<string, Record<string, string>>;
  subclassFeatures: Record<string, string>;
};

/**
 * What players call a resource, and the feature 5e.tools files it under.
 * Spell slots are the class's Spellcasting (or Pact Magic) feature.
 */
const FEATURE_ALIASES: Record<string, string> = {
  'focus points': "monk's focus",
  'focus': "monk's focus",
  'ki': "monk's focus",
  'ki points': "monk's focus",
  'sorcery points': 'font of magic',
  'superiority dice': 'combat superiority',
  'superiority die': 'combat superiority',
  'lay on hands pool': 'lay on hands',
  'rages': 'rage',
  'psionic energy dice': 'psionic power',
  'psionic energy': 'psionic power'
};

function featureName(label: string): string {
  const clean = lookupName(label).toLowerCase();
  if (/\bpact\b.*\bslots?$/.test(clean)) return 'pact magic';
  if (/\bslots?$/.test(clean)) return 'spellcasting';
  return FEATURE_ALIASES[clean] ?? clean;
}

/**
 * The link for a tracker, from what it is called and where it comes from.
 *
 * - From a class: straight to the feature on the class page
 *   (classes.html#fighter_xphb,state:feature=s0-1 is Second Wind), or to the
 *   subclass for a subclass feature (Combat Superiority opens Battle Master).
 *   A feature 5e.tools does not list opens the class page itself.
 * - From anything else (a feat such as Lucky, a species, an item): the link
 *   is for that, since "Luck Points" is not an entry but Lucky is.
 * - From nothing: a search for the tracker's own name, as before.
 */
export function trackerUrl(
  tracker: { label: string; class?: string; source?: string },
  classes: { name: string; source?: string }[] = []
): string | null {
  const written = tracker.source?.trim().toLowerCase();
  if (written && UNLINKABLE.has(written)) return null;
  const from = tracker.class?.trim() ?? '';
  if (!from) return lookupUrl(tracker.label, tracker.source, 'any');

  const cls = from.toLowerCase();
  const own = classes.find((c) => c.name.trim().toLowerCase() === cls);
  const src = sourceId(written || own?.source?.trim() || '');
  const key = [src && `${cls}|${src}`, `${cls}|xphb`, `${cls}|phb`].find(
    (k) => k && FEATURES.classes[k as string]
  ) as string | undefined;
  if (key) {
    const [, book] = key.split('|');
    const page = `${LOOKUP_BASE}/classes.html#${hashPart(cls)}_${hashPart(book)}`;
    const feature = featureName(tracker.label);
    const at = FEATURES.classes[key][feature];
    if (at) return `${page},state:feature=s${at}`;
    const sub = FEATURES.subclassFeatures[feature]?.split('|');
    if (sub && sub[0] === cls) {
      return `${LOOKUP_BASE}/classes.html#${hashPart(cls)}_${hashPart(sub[1])},state:sub_${hashPart(sub[2])}_${hashPart(sub[3])}=b1`;
    }
    return page;
  }
  // A homebrew class (one of theirs, but not on 5e.tools' class list): the
  // tracker's own name, searched in its book.
  if (own) return lookupUrl(tracker.label, tracker.source, 'any');
  return lookupUrl(from, tracker.source, 'any');
}
