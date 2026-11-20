/**
 * Links to a class feature on 5e.tools, from a tracker or a feature on the
 * sheet: straight to its row on the class page, or to the subclass that
 * gains it. Kept apart from rules/lookup because of the table it reads
 * (data/class-features.json), which only a sheet needs.
 */

import CLASS_FEATURES from '#lib/data/class-features.json';
import { LOOKUP_BASE } from './fiveBase.ts';
import { entryUrl, hashPart, isHomebrew, lookupName, lookupUrl, sourceId } from './lookup.ts';

type ClassIndex = {
  classes: Record<string, Record<string, string>>;
  /** Per class, the row each level's subclass features are drawn under. */
  gains: Record<string, Record<string, string>>;
  /** Subclass feature → class|classSource|subclass|subclassSource|level.
      A homebrew class's are filed as "<class>::<feature>", so they never
      shadow a published one of the same name. */
  subclassFeatures: Record<string, string>;
};
const FEATURES = CLASS_FEATURES as ClassIndex;

/** Adds a homebrew class's features, fetched for a sheet that has it (rules/brewClasses.ts). */
export function registerClassData(extra: ClassIndex) {
  Object.assign(FEATURES.classes, extra.classes);
  Object.assign(FEATURES.gains, extra.gains);
  for (const [name, at] of Object.entries(extra.subclassFeatures)) {
    FEATURES.subclassFeatures[`${at.split('|')[0]}::${name}`] = at;
  }
}
/** Whether a class (by name and 5e.tools source id) is known. */
export const knowsClass = (name: string, source: string) => `${name.trim().toLowerCase()}|${source}` in FEATURES.classes;
const subFeature = (cls: string, name: string) =>
  FEATURES.subclassFeatures[`${cls}::${name}`] ?? FEATURES.subclassFeatures[name];

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
  classes: { name: string; source?: string }[] = [],
  /** The sheet's other books (species, background), for which edition to open. */
  books: (string | undefined)[] = []
): string | null {
  const written = tracker.source?.trim().toLowerCase();
  if (isHomebrew(written)) return null;
  const from = tracker.class?.trim() ?? '';
  const sheetBooks = [...classes.map((c) => c.source), ...books];
  // Named for something with its own page (a spell cast once a day, a
  // wand's charges, a feat's uses): that page.
  const own = () => entryUrl(tracker.label, tracker.source, sheetBooks);
  if (!from) return own() ?? lookupUrl(tracker.label, tracker.source, 'any');

  const cls = from.toLowerCase();
  const ownClass = classes.find((c) => c.name.trim().toLowerCase() === cls);
  const src = sourceId(written || ownClass?.source?.trim() || '');
  const key = [src && `${cls}|${src}`, `${cls}|xphb`, `${cls}|phb`].find(
    (k) => k && FEATURES.classes[k as string]
  ) as string | undefined;
  if (key) {
    const [, book] = key.split('|');
    const page = `${LOOKUP_BASE}/classes.html#${hashPart(cls)}_${hashPart(book)}`;
    const feature = featureName(tracker.label);
    const at = FEATURES.classes[key][feature];
    if (at) return `${page},state:feature=s${at}`;
    const sub = subFeature(cls, feature)?.split('|');
    if (sub && sub[0] === cls) {
      // The subclass chosen, and scrolled to the level it gains the feature,
      // where 5e.tools draws the subclass's features under the class's own row.
      const gain = FEATURES.gains[`${cls}|${sub[1]}`]?.[sub[4]];
      const chosen = `sub_${hashPart(sub[2])}_${hashPart(sub[3])}=b1`;
      return `${LOOKUP_BASE}/classes.html#${hashPart(cls)}_${hashPart(sub[1])},state:${gain ? `feature=s${gain}~` : ''}${chosen}`;
    }
    return own() ?? page;
  }
  // A homebrew class (one of theirs, but not on 5e.tools' class list): the
  // tracker's own name, searched in its book.
  // The search names the class's book, so a homebrew class's own feature
  // (a Gunslinger's Grit) is looked for where it is written.
  if (ownClass) return own() ?? lookupUrl(tracker.label, tracker.source || ownClass.source, 'any');
  // From a species, feat, item or background: the tracker's own page if it
  // has one (Invisibility from a Tiefling), else what it comes from.
  return own() ?? entryUrl(from, tracker.source, sheetBooks) ?? lookupUrl(from, tracker.source, 'any');
}

/**
 * The link for a feature, from where it comes from. A feature on the sheet is
 * usually a piece of something bigger: Hellish Resistance and Legacy of
 * Malbolge are both part of the Tiefling entry, so a species feature links to
 * the species written on the Character tab, a background feature to the
 * background, and a class or subclass feature to its place on the class page.
 * A feat, or anything else, keeps its own name.
 */
export function featureUrl(
  feature: { title: string; kind?: string; source?: string },
  identity: { ancestry?: string; ancestrySource?: string; background?: string; backgroundSource?: string },
  classes: { name: string; subclass?: string; source?: string }[] = []
): string | null {
  const written = feature.source?.trim().toLowerCase();
  if (isHomebrew(written)) return null;
  const kind = (feature.kind ?? '').toLowerCase();
  if (kind === 'species' && identity.ancestry?.trim()) {
    return lookupUrl(identity.ancestry, identity.ancestrySource, 'races');
  }
  if (kind === 'background' && identity.background?.trim()) {
    return lookupUrl(identity.background, identity.backgroundSource, 'backgrounds');
  }
  if ((kind === 'class' || kind === 'subclass') && classes.length) {
    const name = featureName(feature.title);
    // The class whose features include it, or the first one.
    for (const c of classes) {
      const url = trackerUrl({ label: feature.title, class: c.name, source: feature.source || c.source }, classes);
      const key = `${c.name.trim().toLowerCase()}|`;
      const known =
        Object.keys(FEATURES.classes).some((k) => k.startsWith(key) && FEATURES.classes[k][name]) ||
        subFeature(c.name.trim().toLowerCase(), name)?.startsWith(key);
      if (known && url) return url;
    }
    if (kind === 'subclass') {
      const withSub = classes.find((c) => c.subclass?.trim());
      if (withSub) {
        const url = lookupUrl(withSub.subclass!, withSub.source, 'subclasses', undefined, { name: withSub.name, source: withSub.source });
        // Scrolled to where the subclass is chosen, its first features below.
        const book = sourceId(withSub.source?.trim() || 'xphb');
        const gain = Object.entries(FEATURES.gains[`${withSub.name.trim().toLowerCase()}|${book}`] ?? {})
          .sort(([a], [b]) => Number(a) - Number(b))[0]?.[1];
        return url && gain && url.includes(',state:') ? url.replace(',state:', `,state:feature=s${gain}~`) : url;
      }
    }
    return trackerUrl({ label: feature.title, class: classes[0].name, source: feature.source || classes[0].source }, classes);
  }
  return entryUrl(feature.title, feature.source, [...classes.map((c) => c.source), identity.ancestrySource, identity.backgroundSource])
    ?? lookupUrl(feature.title, feature.source, 'feats');
}
