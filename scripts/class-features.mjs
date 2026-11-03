// Writes src/lib/data/class-features.json: where each class feature sits on
// its 5e.tools class page, so a tracker can link straight to it. 5e.tools
// scrolls to a feature named by its level and its place among that level's
// features ("state:feature=s0-1" is Second Wind, the 2nd feature at 1st
// level). Subclass features open their subclass. Run `npm run class-features`.
import { writeFile } from 'node:fs/promises';

const BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/class';
const get = async (name) => (await fetch(`${BASE}/${name}`)).json();
const index = await get('index.json');
const SKIP = new Set(['mystic', 'sidekick']);

const classes = {};
const subclassFeatures = {};
const clash = new Set();
for (const [key, file] of Object.entries(index)) {
  if (SKIP.has(key)) continue;
  const data = await get(file);
  // A feature written as an inset is not one of the page's features.
  const inset = new Set(
    (data.classFeature ?? [])
      .filter((f) => f.type === 'inset')
      .map((f) => [f.name, f.className, f.classSource, f.level, f.source].join('|').toLowerCase())
  );
  for (const cls of data.class ?? []) {
    const perLevel = {};
    const out = {};
    for (const entry of cls.classFeatures ?? []) {
      const ref = typeof entry === 'string' ? entry : entry.classFeature;
      const [name, className, classSource, level, source] = ref.split('|');
      const full = [name, className, classSource || cls.source, level, source || classSource || cls.source].join('|').toLowerCase();
      if (inset.has(full)) continue;
      const ixLevel = Number(level) - 1;
      const ixFeature = (perLevel[ixLevel] = (perLevel[ixLevel] ?? -1) + 1);
      const k = name.toLowerCase();
      if (!(k in out)) out[k] = `${ixLevel}-${ixFeature}`;
    }
    classes[`${cls.name.toLowerCase()}|${cls.source.toLowerCase()}`] = out;
  }
  // Every subclass feature, including those nested under the subclass's
  // first one ("Combat Superiority" sits inside "Battle Master").
  for (const f of data.subclassFeature ?? []) {
    if (f.type === 'inset' || !f.name) continue;
    const name = f.name.toLowerCase();
    const value = [f.className, f.classSource, f.subclassShortName, f.subclassSource].map((s) => String(s).toLowerCase()).join('|');
    if (name in subclassFeatures && subclassFeatures[name] !== value) {
      // The newer book wins a clash with an older one; others are dropped.
      if (value.endsWith('|xphb') && !subclassFeatures[name].endsWith('|xphb')) subclassFeatures[name] = value;
      else if (!subclassFeatures[name].endsWith('|xphb')) clash.add(name);
      continue;
    }
    subclassFeatures[name] = value;
  }
}
for (const k of clash) if (!subclassFeatures[k].endsWith("|xphb")) delete subclassFeatures[k];
await writeFile(
  new URL('../src/lib/data/class-features.json', import.meta.url),
  JSON.stringify({ classes, subclassFeatures }) + '\n'
);
console.log(`${Object.keys(classes).length} classes, ${Object.keys(subclassFeatures).length} subclass features`);
