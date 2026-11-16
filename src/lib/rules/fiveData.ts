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
  | 'bestiary'
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

import CLASS_FEATURES from '$lib/data/class-features.json';

/** Homebrew lives in its own repository, which 5e.tools reads too. */
const BREW = 'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/';

const files = new Map<string, Promise<Raw>>();

function load(path: string, base = BASE): Promise<Raw> {
  const url = base + path.split('/').map(encodeURIComponent).join('/');
  let p = files.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`5e.tools data ${path}: ${r.status}`);
      return r.json() as Promise<Raw>;
    });
    // A failure is not kept: the next peek tries again.
    p.catch(() => files.delete(url));
    files.set(url, p);
  }
  return p;
}

/**
 * The homebrew file that holds a book (a source id such as
 * "valdagunslinger"), or null when the book is not homebrew.
 */
async function brew(source: string): Promise<Raw | null> {
  if (!source) return null;
  const index = (await load('_generated/index-sources.json', BREW).catch(() => ({}))) as Record<string, string>;
  const key = Object.keys(index).find((k) => same(k, source));
  return key ? load(index[key], BREW).catch(() => null) : null;
}

/** Names for item types and properties ("V" is Versatile), from 5e.tools and the item's own file. */
export type ItemWords = { types: Record<string, string>; props: Record<string, string> };

function itemWords(...sources: (Raw | null)[]): ItemWords {
  const words: ItemWords = { types: {}, props: {} };
  for (const data of sources) {
    for (const t of data?.itemType ?? []) if (t.abbreviation && t.name) words.types[String(t.abbreviation).toUpperCase()] ??= t.name;
    for (const p of data?.itemProperty ?? []) {
      const name = p.name ?? p.entries?.[0]?.name;
      if (p.abbreviation && name) words.props[String(p.abbreviation).toUpperCase()] ??= name;
    }
  }
  return words;
}

export type Found =
  | { kind: 'spell' | 'feat' | 'race' | 'background' | 'condition' | 'optionalfeature'; entry: Raw }
  | { kind: 'item'; entry: Raw; words?: ItemWords }
  | { kind: 'class'; entry: Raw; features: Raw[] }
  | { kind: 'subclass'; entry: Raw; features: Raw[]; only: boolean }
  | { kind: 'classFeature'; entry: Raw; features: Raw[] }
  | { kind: 'monster'; entry: Raw };

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
  const home = await brew(source);
  const own = home && pick((home.spell ?? []).filter((e: Raw) => same(e.source, source)), name, source);
  if (own) return own;
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

async function findItem(name: string, source: string): Promise<{ entry: Raw; words: ItemWords } | null> {
  const [base, items, home] = await Promise.all([load('items-base.json'), load('items.json'), brew(source)]);
  const inBrew = home && pick([...(home.item ?? []), ...(home.baseitem ?? [])].filter((e: Raw) => same(e.source, source)), name, source);
  const entry = inBrew || pick([...(items.item ?? []), ...(items.itemGroup ?? []), ...(base.baseitem ?? [])], name, source);
  return entry ? { entry, words: itemWords(home, base) } : null;
}

async function findIn(path: string, key: string, name: string, source: string): Promise<Raw | null> {
  const home = await brew(source);
  const own = home && pick((home[key] ?? []).filter((e: Raw) => same(e.source, source)), name, source);
  if (own) return own;
  const data = await load(path);
  return pick(data[key] ?? [], name, source);
}

async function findRace(name: string, source: string): Promise<Raw | null> {
  const [data, home] = await Promise.all([load('races.json'), brew(source)]);
  const races = [...(home?.race ?? []), ...(data.race ?? [])];
  const subraces = [...(home?.subrace ?? []), ...(data.subrace ?? [])];
  const race = pick(races, name, source);
  if (race) return race;
  // A subrace is named "Tiefling (Glasya)" on the page, "Glasya" in the data:
  // the race's traits with the subrace's added (or put in place of the
  // trait it rewrites).
  const m = name.match(/^(.+?)\s*\((.+)\)$/);
  if (!m) return null;
  const subs = subraces.filter((s: Raw) => same(s.name, m[2]) && same(s.raceName, m[1]));
  const sub = subs.find((s: Raw) => same(s.source, source)) ?? subs[0];
  if (!sub) return null;
  const parent = races.find((r: Raw) => same(r.name, sub.raceName) && same(r.source, sub.raceSource)) ?? pick(races, sub.raceName, sub.raceSource);
  const entries: unknown[] = [...(parent?.entries ?? [])];
  for (const e of sub.entries ?? []) {
    const replaces = (e as Raw)?.data?.overwrite;
    const at = replaces ? entries.findIndex((x) => same((x as Raw)?.name, replaces)) : -1;
    if (at >= 0) entries[at] = e;
    else entries.push(e);
  }
  return { ...parent, ...sub, name: `${sub.raceName} (${sub.name})`, entries, size: sub.size ?? parent?.size, speed: sub.speed ?? parent?.speed };
}

/** A class page: the class, a subclass of it, or one of its features. */
async function findClass(t: PeekTarget, label: string): Promise<Found | null> {
  const index = (await load('class/index.json')) as Record<string, string>;
  const file = index[t.name.toLowerCase().replace(/[^a-z]/g, '')] ?? index[t.name.toLowerCase()];
  const home = await brew(t.source);
  const homeClass = home && pick((home.class ?? []).filter((c: Raw) => same(c.source, t.source)), t.name, t.source);
  const data = homeClass ? home! : file ? await load(`class/${file}`) : null;
  if (!data) return null;
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
      // One feature asked for: that feature, under its own name.
      if (named.length) return { kind: 'classFeature', entry: named[0], features: all };
      const features = atLevel.length ? atLevel : all;
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

/**
 * A class or subclass feature by its name alone, as a search finds it: in
 * the homebrew book named, else in the published class that has it.
 */
async function findFeature(name: string, source: string): Promise<Found | null> {
  const home = await brew(source);
  const lists = (data: Raw) => [...(data.classFeature ?? []), ...(data.subclassFeature ?? [])].filter((f: Raw) => f.type !== 'inset');
  const inBrew = home && pick(lists(home), name, source);
  if (inBrew) return { kind: 'classFeature', entry: inBrew, features: [] };
  const key = name.toLowerCase();
  const index = CLASS_FEATURES as { classes: Record<string, Record<string, string>>; subclassFeatures: Record<string, string> };
  const owner =
    Object.keys(index.classes).find((k) => key in index.classes[k] && (!source || k.endsWith(`|${source.toLowerCase()}`))) ??
    Object.keys(index.classes).find((k) => key in index.classes[k] && k.endsWith('|xphb')) ??
    Object.keys(index.classes).find((k) => key in index.classes[k]) ??
    index.subclassFeatures[key]?.split('|').slice(0, 2).join('|');
  if (!owner) return null;
  const files = (await load('class/index.json')) as Record<string, string>;
  const file = files[owner.split('|')[0].replace(/[^a-z]/g, '')];
  if (!file) return null;
  const data = await load(`class/${file}`);
  const hit = pick(lists(data), name, source || owner.split('|')[1]);
  return hit ? { kind: 'classFeature', entry: hit, features: [] } : null;
}

/** The books whose monsters are looked through first when a link names none. */
const MONSTERS_FIRST = ['XMM', 'MM', 'MPMM', 'VGM', 'MTF'];

/**
 * A monster, by name and (if known) its book. One made as a copy of another
 * ("_copy") is the other with its own changes laid over it.
 */
export async function findMonster(name: string, source: string, depth = 0): Promise<Raw | null> {
  const index = (await load('bestiary/index.json')) as Record<string, string>;
  const books = Object.keys(index);
  let order = [...new Set([...(source ? books.filter((b) => same(b, source)) : []), ...MONSTERS_FIRST])].filter((b) => index[b]);
  if (!source) {
    // Which books have it, from the search index (bundled, loaded only now).
    const rows = ((await import('$lib/data/search-index.json')).default as [string, string, string, string][])
      .filter(([n, k]) => k === 'm' && same(n, name))
      .map(([, , b]) => books.find((x) => same(x, b)))
      .filter((b): b is string => Boolean(b));
    order = [...new Set([...order.filter((b) => rows.includes(b)), ...rows])];
  }
  for (const b of order) {
    const data = await load(`bestiary/${index[b]}`);
    const hit = pick(data.monster ?? [], name, source);
    if (!hit) continue;
    if (hit._copy && depth < 3) {
      const base = await findMonster(hit._copy.name, hit._copy.source ?? '', depth + 1);
      if (base) {
        const own = Object.fromEntries(Object.entries(hit).filter(([k]) => k !== '_copy' && k !== '_mod'));
        return { ...base, ...own };
      }
    }
    return hit;
  }
  const home = await brew(source);
  return home ? pick((home.monster ?? []).filter((e: Raw) => same(e.source, source)), name, source) : null;
}

/** The entry a link points at, in 5e.tools' data; null when it is not there. */
export async function findEntry(t: PeekTarget, label = ''): Promise<Found | null> {
  const { name, source } = t;
  const one = async (kind: Exclude<Found['kind'], 'class' | 'subclass' | 'classFeature' | 'item'>, entry: Promise<Raw | null>) => {
    const e = await entry;
    return e ? ({ kind, entry: e } as Found) : null;
  };
  switch (t.page) {
    case 'spells':
      return one('spell', findSpell(name, source, true));
    case 'items': {
      const hit = await findItem(name, source);
      return hit ? { kind: 'item', entry: hit.entry, words: hit.words } : null;
    }
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
    case 'bestiary':
      return one('monster', findMonster(name, source));
    case 'any': {
      // A search with no category: each kind in turn, spells first
      // ("Invisibility" is a spell before it is anything else).
      const tries: (() => Promise<Found | null>)[] = [
        () => one('spell', findSpell(name, source, false)),
        () => one('optionalfeature', findIn('optionalfeatures.json', 'optionalfeature', name, source)),
        () => one('feat', findIn('feats.json', 'feat', name, source)),
        () => findEntry({ ...t, page: 'items' }),
        () => one('race', findRace(name, source)),
        () => one('background', findIn('backgrounds.json', 'background', name, source)),
        () => findEntry({ ...t, page: 'conditionsdiseases' }),
        () => findFeature(name, source),
        () => one('monster', findMonster(name, source))
      ];
      for (const attempt of tries) {
        const found = await attempt().catch(() => null);
        if (found) return found;
      }
      return null;
    }
  }
}
