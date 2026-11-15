/**
 * 5e.tools' own data, read straight from its published source on GitHub
 * (the site's data files, which GitHub serves to any page), so the peek can
 * show an entry from its name to its source and nothing else.
 *
 * Files are fetched when first needed and kept for the visit.
 */
/** Which of 5e.tools' pages an entry is on; `any` when a search names none. */
export type PeekPage =
  | 'spells'
  | 'items'
  | 'feats'
  | 'races'
  | 'backgrounds'
  | 'conditionsdiseases'
  | 'optionalfeatures'
  | 'classes'
  | 'any';

/** An entry as a 5e.tools link names it. */
export type PeekTarget = {
  page: PeekPage;
  name: string;
  /** The book, as 5e.tools writes it in a link ("xphb"); empty when unknown. */
  source: string;
  /** On a class page: the subclass chosen ("battle master", its book). */
  subclass?: { name: string; source: string };
  /** On a class page: the feature scrolled to, by level (1–20) and place in that level. */
  feature?: { level: number; index: number };
};

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Raw = Record<string, any>;

const files = new Map<string, Promise<Raw>>();

function load(path: string): Promise<Raw> {
  let p = files.get(path);
  if (!p) {
    p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`5e.tools data ${path}: ${r.status}`);
      return r.json() as Promise<Raw>;
    });
    // A failure is not kept: the next peek tries again.
    p.catch(() => files.delete(path));
    files.set(path, p);
  }
  return p;
}

export type Found =
  | { kind: 'spell' | 'item' | 'feat' | 'race' | 'background' | 'condition' | 'optionalfeature'; entry: Raw }
  | { kind: 'class'; entry: Raw; features: Raw[] }
  | { kind: 'subclass'; entry: Raw; features: Raw[]; only: boolean }
  | { kind: 'classFeature'; entry: Raw; features: Raw[] };

const same = (a: unknown, b: unknown) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

/** Among entries of one name, the one in the book asked for, else the newest rules, else the first. */
function pick(list: Raw[], name: string, source: string): Raw | null {
  const named = list.filter((e) => same(e.name, name));
  if (!named.length) return null;
  return (
    (source && named.find((e) => same(e.source, source))) ||
    named.find((e) => same(e.source, 'xphb')) ||
    named.find((e) => same(e.source, 'phb')) ||
    named[0]
  );
}

/** The books whose spells are looked through first when a link names none. */
const SPELL_FIRST = ['XPHB', 'PHB', 'XGE', 'TCE'];

async function findSpell(name: string, source: string, everywhere: boolean): Promise<Raw | null> {
  const index = (await load('spells/index.json')) as Record<string, string>;
  const books = Object.keys(index);
  const book = source && books.find((b) => same(b, source));
  const order = [...new Set([...(book ? [book] : []), ...SPELL_FIRST, ...(everywhere ? books : [])])].filter((b) => index[b]);
  for (const b of order) {
    const data = await load(`spells/${index[b]}`);
    const hit = pick(data.spell ?? [], name, source);
    if (hit) return hit;
  }
  return null;
}

async function findItem(name: string, source: string): Promise<Raw | null> {
  const [base, items] = await Promise.all([load('items-base.json'), load('items.json')]);
  return pick([...(items.item ?? []), ...(items.itemGroup ?? []), ...(base.baseitem ?? [])], name, source);
}

async function findIn(path: string, key: string, name: string, source: string): Promise<Raw | null> {
  const data = await load(path);
  return pick(data[key] ?? [], name, source);
}

async function findRace(name: string, source: string): Promise<Raw | null> {
  const data = await load('races.json');
  const race = pick(data.race ?? [], name, source);
  if (race) return race;
  // A subrace is named "Tiefling (Asmodeus)" on the page, "Asmodeus" in the data.
  const m = name.match(/^(.+?)\s*\((.+)\)$/);
  if (!m) return null;
  const sub = (data.subrace ?? []).find((s: Raw) => same(s.name, m[2]) && same(s.raceName, m[1]));
  return sub ? { ...sub, name } : null;
}

/** A class page: the class, a subclass of it, or one of its features. */
async function findClass(t: PeekTarget, label: string): Promise<Found | null> {
  const index = (await load('class/index.json')) as Record<string, string>;
  const file = index[t.name.toLowerCase().replace(/[^a-z]/g, '')] ?? index[t.name.toLowerCase()];
  if (!file) return null;
  const data = await load(`class/${file}`);
  const cls = pick(data.class ?? [], t.name, t.source);
  if (!cls) return null;
  const classFeatures: Raw[] = (data.classFeature ?? []).filter((f: Raw) => same(f.className, cls.name) && same(f.classSource, cls.source));

  if (t.subclass) {
    const sub = (data.subclass ?? []).find(
      (s: Raw) => same(s.shortName, t.subclass!.name) && same(s.source, t.subclass!.source) && same(s.className, cls.name)
    ) ?? (data.subclass ?? []).find((s: Raw) => same(s.shortName, t.subclass!.name) && same(s.className, cls.name));
    if (sub) {
      const all: Raw[] = (data.subclassFeature ?? []).filter(
        (f: Raw) => same(f.subclassShortName, sub.shortName) && same(f.subclassSource, sub.source) && same(f.className, cls.name)
      );
      // The feature the link was for (a tracker's "Superiority Dice" is in
      // "Combat Superiority"), else what the subclass gains at that level.
      const wanted = label.toLowerCase();
      // Named for the subclass itself (its class card): the whole subclass.
      const whole = same(label, sub.name) || same(label, sub.shortName) || !label;
      const named = whole ? [] : all.filter((f) => same(f.name, label) || (wanted && JSON.stringify(f.entries ?? '').toLowerCase().includes(wanted) && f.level === t.feature?.level));
      const atLevel = t.feature && !whole ? all.filter((f) => f.level === t.feature!.level) : [];
      const features = named.length ? named.slice(0, 1) : atLevel.length ? atLevel : all;
      return { kind: 'subclass', entry: sub, features, only: features.length < all.length };
    }
  }

  if (t.feature) {
    // The page counts a level's features in the class's own order, insets left out.
    const insets = new Set(classFeatures.filter((f) => f.type === 'inset').map((f) => `${f.name}|${f.level}`.toLowerCase()));
    const refs = (cls.classFeatures ?? [])
      .map((e: string | Raw) => (typeof e === 'string' ? e : e.classFeature) as string)
      .map((r: string) => r.split('|'))
      .filter(([n, , , lv]: string[]) => Number(lv) === t.feature!.level && !insets.has(`${n}|${lv}`.toLowerCase()));
    const ref = refs[t.feature.index];
    const feature = ref && classFeatures.find((f) => same(f.name, ref[0]) && f.level === t.feature!.level);
    if (feature) return { kind: 'classFeature', entry: feature, features: classFeatures };
  }
  return { kind: 'class', entry: cls, features: classFeatures };
}

/** The entry a link points at, in 5e.tools' data; null when it is not there. */
export async function findEntry(t: PeekTarget, label = ''): Promise<Found | null> {
  const { name, source } = t;
  const one = async (kind: Exclude<Found['kind'], 'class' | 'subclass' | 'classFeature'>, entry: Promise<Raw | null>) => {
    const e = await entry;
    return e ? ({ kind, entry: e } as Found) : null;
  };
  switch (t.page) {
    case 'spells':
      return one('spell', findSpell(name, source, true));
    case 'items':
      return one('item', findItem(name, source));
    case 'feats':
      return one('feat', findIn('feats.json', 'feat', name, source));
    case 'races':
      return one('race', findRace(name, source));
    case 'backgrounds':
      return one('background', findIn('backgrounds.json', 'background', name, source));
    case 'optionalfeatures':
      return one('optionalfeature', findIn('optionalfeatures.json', 'optionalfeature', name, source));
    case 'conditionsdiseases': {
      const data = await load('conditionsdiseases.json');
      const e = pick([...(data.condition ?? []), ...(data.disease ?? []), ...(data.status ?? [])], name, source);
      return e ? { kind: 'condition', entry: e } : null;
    }
    case 'classes':
      return findClass(t, label);
    case 'any': {
      // A search with no category: each kind in turn, spells first
      // ("Invisibility" is a spell before it is anything else).
      const tries: (() => Promise<Found | null>)[] = [
        () => one('spell', findSpell(name, source, false)),
        () => one('optionalfeature', findIn('optionalfeatures.json', 'optionalfeature', name, source)),
        () => one('feat', findIn('feats.json', 'feat', name, source)),
        () => one('item', findItem(name, source)),
        () => one('race', findRace(name, source)),
        () => one('background', findIn('backgrounds.json', 'background', name, source)),
        () => findEntry({ ...t, page: 'conditionsdiseases' })
      ];
      for (const attempt of tries) {
        const found = await attempt().catch(() => null);
        if (found) return found;
      }
      return null;
    }
  }
}
