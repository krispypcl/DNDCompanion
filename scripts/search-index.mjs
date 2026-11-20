// Writes src/lib/data/search-index.json: every entry the search (/)
// can find on 5e.tools, by its proper name: spells, items, feats, optional
// features, species, backgrounds, classes, subclasses, conditions and monsters, each
// with its book and a few words on what it is ("Level 3 Evocation",
// "CR 1 Fey"). Loaded only when the search opens. Run `npm run search-index`.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';
const get = async (path) => {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

const SCHOOL = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation' };
const cap = (s) => String(s ?? '').replace(/\b\w/g, (c) => c.toUpperCase());
/**
 * [name, kind, book, words] — kind: s spell, i item, f feat, o option, r species, b background, c class,
 * u subclass, d condition, m monster. A subclass adds a fifth: "class|class book|short name".
 */
const rows = [];
const seen = new Set();
const add = (name, kind, source, words = '', extra = '') => {
  if (!name || !source) return;
  const key = `${kind}|${name.toLowerCase()}|${source.toLowerCase()}`;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(extra ? [name, kind, source, words, extra] : [name, kind, source, words]);
};

const spellIndex = await get('spells/index.json');
for (const file of Object.values(spellIndex)) {
  for (const sp of (await get(`spells/${file}`)).spell ?? []) {
    add(sp.name, 's', sp.source, sp.level === 0 ? `${SCHOOL[sp.school] ?? ''} Cantrip` : `Level ${sp.level} ${SCHOOL[sp.school] ?? ''}`);
  }
}
for (const it of (await get('items.json')).item ?? []) add(it.name, 'i', it.source, it.rarity && it.rarity !== 'none' ? cap(it.rarity) : 'Item');
for (const it of (await get('items-base.json')).baseitem ?? []) add(it.name, 'i', it.source, it.weapon ? 'Weapon' : it.armor ? 'Armor' : 'Item');
for (const ft of (await get('feats.json')).feat ?? []) add(ft.name, 'f', ft.source, 'Feat');
for (const of of (await get('optionalfeatures.json')).optionalfeature ?? []) add(of.name, 'o', of.source, 'Option');
const races = await get('races.json');
for (const r of races.race ?? []) add(r.name, 'r', r.source, 'Species');
for (const bg of (await get('backgrounds.json')).background ?? []) add(bg.name, 'b', bg.source, 'Background');
const classIndex = await get('class/index.json');
for (const file of Object.values(classIndex)) {
  const data = await get(`class/${file}`);
  for (const c of data.class ?? []) add(c.name, 'c', c.source, 'Class');
  // A subclass opens on its class's page, so its row also carries the class,
  // the class's book and the subclass's short name (5e.tools links by those).
  for (const sc of data.subclass ?? []) {
    if (!sc.className || !sc.shortName) continue;
    add(sc.name, 'u', sc.source, `${sc.className} Subclass`, `${sc.className}|${sc.classSource ?? sc.source}|${sc.shortName}`);
  }
}
const cd = await get('conditionsdiseases.json');
for (const c of cd.condition ?? []) add(c.name, 'd', c.source, 'Condition');
for (const c of cd.disease ?? []) add(c.name, 'd', c.source, 'Disease');

const typeOf = (t) => {
  const base = typeof t === 'string' ? t : typeof t?.type === 'string' ? t.type : (t?.type?.choose ?? []).join(' or ');
  return cap(base);
};
const crOf = (cr) => (cr == null ? '' : typeof cr === 'string' ? cr : cr.cr ?? '');
const bestiary = await get('bestiary/index.json');
for (const file of Object.values(bestiary)) {
  for (const m of (await get(`bestiary/${file}`)).monster ?? []) {
    const cr = crOf(m.cr ?? m._copy?.cr);
    const words = [cr && `CR ${cr}`, typeOf(m.type)].filter(Boolean).join(' ');
    add(m.name, 'm', m.source, words || 'Creature');
  }
}

rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
await writeFile(new URL('../src/lib/data/search-index.json', import.meta.url), JSON.stringify(rows));
const count = {};
for (const r of rows) count[r[1]] = (count[r[1]] ?? 0) + 1;
console.log(rows.length, count);
