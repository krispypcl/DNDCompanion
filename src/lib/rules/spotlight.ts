/**
 * The search (/): finding 5e.tools entries by name in the search index
 * (scripts/search-index.mjs), best matches first, one row per entry (the
 * newest book's when an entry is in several), and the 5e.tools link each
 * one opens in a pop-up.
 */
import { LOOKUP_BASE } from './fiveBase.ts';
import { morePage } from './fiveMore';

/**
 * [name, kind, book, words] as the index writes it; a subclass adds "class|class
 * book|short name", and an entry of another page (kind g, rules/fiveMore) its page.
 */
export type IndexRow = [string, string, string, string] | [string, string, string, string, string];
export type Hit = { name: string; kind: string; source: string; words: string; label: string; url: string };

export const KIND_LABEL: Record<string, string> = {
  s: 'Spell', i: 'Item', f: 'Feat', o: 'Option', r: 'Species', b: 'Background', c: 'Class', u: 'Subclass', d: 'Condition',
  m: 'Creature', g: 'Reference'
};
const PAGE: Record<string, string> = {
  s: 'spells.html', i: 'items.html', f: 'feats.html', o: 'optionalfeatures.html', r: 'races.html',
  b: 'backgrounds.html', c: 'classes.html', d: 'conditionsdiseases.html', m: 'bestiary.html'
};
/** Among the same entry in several books, the newest rules first. */
const BOOKS = ['XPHB', 'XMM', 'XDMG', 'PHB', 'MM', 'DMG', 'MPMM', 'XGE', 'TCE', 'VGM', 'MTF'];
const bookRank = (b: string) => {
  const i = BOOKS.indexOf(b.toUpperCase());
  return i < 0 ? BOOKS.length : i;
};
const hash = (s: string) => encodeURIComponent(s.toLowerCase()).toLowerCase();

/** The 5e.tools page for an entry of the index. A subclass is its class's page, with the subclass chosen. */
export function entryUrl(name: string, kind: string, source: string, extra = ''): string {
  if (kind === 'u') {
    const [cls, clsSource, short] = extra.split('|');
    if (cls && clsSource && short) {
      return `${LOOKUP_BASE}/classes.html#${hash(cls)}_${hash(clsSource)},state:sub_${hash(short)}_${hash(source)}=b1`;
    }
  }
  if (kind === 'g' && morePage(extra)) return `${LOOKUP_BASE}/${extra}.html#${hash(name)}_${hash(source)}`;
  return `${LOOKUP_BASE}/${PAGE[kind] ?? 'search.html'}#${hash(name)}_${hash(source)}`;
}

/** How well a name matches: 0 the same, 1 starts with it, 2 a word starts with it, 3 holds it; -1 not at all. */
export function matchRank(name: string, query: string): number {
  const n = name.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return -1;
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/[\s(/,-]+/).some((w) => w.startsWith(q))) return 2;
  return n.includes(q) ? 3 : -1;
}

/** The best `limit` entries for a query (two letters or more), one per name and kind. */
export function search(rows: IndexRow[], query: string, limit = 30, kinds?: string[]): Hit[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const best = new Map<string, { row: IndexRow; rank: number }>();
  for (const row of rows) {
    if (kinds && !kinds.includes(row[1])) continue;
    const rank = matchRank(row[0], q);
    if (rank < 0) continue;
    // Subclasses of the same name in different classes are different entries.
    const key = `${row[1]}|${row[0].toLowerCase()}${row[1] === 'u' ? `|${row[3]}` : ''}`;
    const had = best.get(key);
    if (!had || bookRank(row[2]) < bookRank(had.row[2])) best.set(key, { row, rank });
  }
  return [...best.values()]
    .sort((a, b) => a.rank - b.rank || a.row[0].length - b.row[0].length || a.row[0].localeCompare(b.row[0]))
    .slice(0, limit)
    .map(({ row: [name, kind, source, words, extra] }) => ({
      name, kind, source, words, label: KIND_LABEL[kind] ?? 'Entry', url: entryUrl(name, kind, source, extra)
    }));
}
