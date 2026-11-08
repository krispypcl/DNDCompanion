// Writes src/lib/data/entry-index.json: every spell, item, feat, optional
// feature (invocations, maneuvers, metamagic, infusions…), species and
// background on 5e.tools, by name, with the books it is in. A tracker or a
// feature named for one of them ("Invisibility", "Wand of Magic Missiles",
// "Lucky") then links straight to its page instead of searching.
// Run `npm run entry-index`.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data';
const get = async (path) => {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

/** kind → name (lower case) → books (lower case), first the newest edition. */
const out = { s: {}, i: {}, f: {}, o: {}, r: {}, b: {} };
const add = (kind, name, source) => {
  if (!name || !source) return;
  const key = name.toLowerCase();
  const src = source.toLowerCase();
  const list = (out[kind][key] ??= []);
  if (!list.includes(src)) list.push(src);
};

const spellIndex = await get('spells/index.json');
for (const file of Object.values(spellIndex)) {
  for (const sp of (await get(`spells/${file}`)).spell ?? []) add('s', sp.name, sp.source);
}
for (const it of (await get('items.json')).item ?? []) add('i', it.name, it.source);
for (const it of (await get('items-base.json')).baseitem ?? []) add('i', it.name, it.source);
for (const ft of (await get('feats.json')).feat ?? []) add('f', ft.name, ft.source);
for (const of of (await get('optionalfeatures.json')).optionalfeature ?? []) add('o', of.name, of.source);
const races = await get('races.json');
for (const r of races.race ?? []) add('r', r.name, r.source);
for (const sr of races.subrace ?? []) {
  if (!sr.name || !sr.raceName) continue;
  // 5e.tools names a subrace "Tiefling (Glasya)", in the subrace's book.
  add('r', `${sr.raceName} (${sr.name})`, sr.source);
}
for (const bg of (await get('backgrounds.json')).background ?? []) add('b', bg.name, bg.source);

// Compact: "phb,xphb" rather than an array.
const compact = Object.fromEntries(
  Object.entries(out).map(([k, names]) => [k, Object.fromEntries(Object.entries(names).map(([n, s]) => [n, s.join(',')]))])
);
await writeFile(new URL('../src/lib/data/entry-index.json', import.meta.url), JSON.stringify(compact));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Object.keys(v).length])));
