// Writes src/lib/data/subclass-short.json: subclass names as players write
// them ("Path of the Berserker", "College of Lore") mapped to the short names
// 5e.tools uses in its links ("berserker", "lore"). Only official books; run
// with `npm run subclass-names` to refresh.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/class';
const index = await (await fetch(`${BASE}/index.json`)).json();
const map = {};
const clash = new Set();
for (const file of Object.values(index)) {
  const data = await (await fetch(`${BASE}/${file}`)).json();
  for (const sc of data.subclass ?? []) {
    if (!sc.name || !sc.shortName) continue;
    const k = sc.name.toLowerCase();
    const v = sc.shortName.toLowerCase();
    if (k === v) continue;
    if (k in map && map[k] !== v) clash.add(k);
    map[k] = v;
  }
}
for (const k of clash) delete map[k];
const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(new URL('../src/lib/data/subclass-short.json', import.meta.url), JSON.stringify(sorted) + '\n');
console.log(`${Object.keys(sorted).length} subclass names`);
