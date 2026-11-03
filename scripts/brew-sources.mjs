// Writes src/lib/data/brew-sources.json: 5e.tools homebrew abbreviations
// (what 5e.tools shows, e.g. "GC:VSS'24") mapped to the source ids its links
// use (e.g. "valdagunslinger"). Also writes brew-class-files.json: for each
// homebrew class's source id, the file it is in, so a sheet with a homebrew
// class can fetch that one file for its feature links (rules/brewClasses.ts).
// Run with `npm run brew-sources` to refresh.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/_generated';
const get = async (name) => (await fetch(`${BASE}/${name}`)).json();
const [meta, sources] = await Promise.all([get('index-meta.json'), get('index-sources.json')]);

const idsByFile = {};
for (const [id, path] of Object.entries(sources)) {
  const file = path.slice(path.indexOf('/') + 1);
  (idsByFile[file] ??= []).push(id);
}

const map = {};
const clash = new Set();
for (const [file, info] of Object.entries(meta)) {
  const ids = idsByFile[file] ?? [];
  // A file with several sources cannot be paired reliably, so only files
  // with one source are used.
  if (ids.length !== 1) continue;
  const id = ids[0].toLowerCase();
  for (const abbr of info.a ?? []) {
    const key = abbr.toLowerCase();
    if (key === id) continue;
    if (key in map && map[key] !== id) clash.add(key);
    map[key] = id;
  }
}
for (const key of clash) delete map[key];
const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(new URL('../src/lib/data/brew-sources.json', import.meta.url), JSON.stringify(sorted) + '\n');
console.log(`${Object.keys(sorted).length} abbreviations`);

const classFiles = Object.fromEntries(
  Object.entries(sources)
    .filter(([, path]) => path.startsWith('class/'))
    .map(([id, path]) => [id.toLowerCase(), path])
    .sort(([a], [b]) => a.localeCompare(b))
);
await writeFile(new URL('../src/lib/data/brew-class-files.json', import.meta.url), JSON.stringify(classFiles) + '\n');
console.log(`${Object.keys(classFiles).length} homebrew class sources`);
