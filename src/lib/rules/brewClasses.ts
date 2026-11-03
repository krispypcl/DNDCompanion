/**
 * Feature links for homebrew classes. The published classes' features are
 * bundled (data/class-features.json); a homebrew class's are fetched, once,
 * from the 5e.tools homebrew repository when a sheet has that class, and
 * indexed the same way, so a Gunslinger's Steely-Eyed Aura links to its place
 * on the Gunslinger page as Second Wind does on the Fighter's.
 */
import { writable } from 'svelte/store';
import BREW_CLASS_FILES from '$lib/data/brew-class-files.json';
import { knowsClass, registerClassData, sourceId } from './lookup';

const REPO = 'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/';
const FILES = BREW_CLASS_FILES as Record<string, string>;

/** Counts up as homebrew classes arrive, so links can be worked out again. */
export const brewLoaded = writable(0);

type Raw = {
  class?: { name: string; source: string; classFeatures?: (string | { classFeature: string; gainSubclassFeature?: boolean })[] }[];
  classFeature?: { name: string; className: string; classSource: string; level: number; source?: string; type?: string }[];
  subclassFeature?: {
    name: string; className: string; classSource: string; subclassShortName: string; subclassSource: string;
    level: number; type?: string;
  }[];
};

/** A class file, indexed as scripts/class-features.mjs indexes the published ones. */
export function indexClassFile(data: Raw) {
  const classes: Record<string, Record<string, string>> = {};
  const gains: Record<string, Record<string, string>> = {};
  const subclassFeatures: Record<string, string> = {};
  const inset = new Set(
    (data.classFeature ?? [])
      .filter((f) => f.type === 'inset')
      .map((f) => [f.name, f.className, f.classSource, f.level, f.source].join('|').toLowerCase())
  );
  for (const cls of data.class ?? []) {
    const perLevel: Record<number, number> = {};
    const out: Record<string, string> = {};
    const gain: Record<string, string> = {};
    for (const entry of cls.classFeatures ?? []) {
      const ref = typeof entry === 'string' ? entry : entry.classFeature;
      const [name, className, classSource, level, source] = ref.split('|');
      const full = [name, className, classSource || cls.source, level, source || classSource || cls.source].join('|').toLowerCase();
      if (inset.has(full)) continue;
      const ixLevel = Number(level) - 1;
      const ixFeature = (perLevel[ixLevel] = (perLevel[ixLevel] ?? -1) + 1);
      const k = name.toLowerCase();
      if (!(k in out)) out[k] = `${ixLevel}-${ixFeature}`;
      if (typeof entry === 'object' && entry.gainSubclassFeature) gain[level] = `${ixLevel}-${ixFeature}`;
    }
    const key = `${cls.name.toLowerCase()}|${cls.source.toLowerCase()}`;
    classes[key] = out;
    gains[key] = gain;
  }
  for (const f of data.subclassFeature ?? []) {
    if (f.type === 'inset' || !f.name) continue;
    const name = f.name.toLowerCase();
    if (name in subclassFeatures) continue;
    subclassFeatures[name] = [f.className, f.classSource, f.subclassShortName, f.subclassSource, f.level]
      .map((s) => String(s).toLowerCase()).join('|');
  }
  return { classes, gains, subclassFeatures };
}

const asked = new Set<string>();

/** Fetches any homebrew classes among these that are not known yet. */
export async function ensureBrewClasses(classes: { name: string; source?: string }[]) {
  for (const c of classes) {
    const src = c.source?.trim() ? sourceId(c.source) : '';
    const path = FILES[src];
    if (!src || !path || asked.has(src) || knowsClass(c.name, src)) continue;
    asked.add(src);
    try {
      const res = await fetch(REPO + path.split('/').map(encodeURIComponent).join('/'));
      if (!res.ok) throw new Error(String(res.status));
      registerClassData(indexClassFile((await res.json()) as Raw));
      brewLoaded.update((n) => n + 1);
    } catch {
      // Offline, or the file moved: the class page itself is still linked.
      asked.delete(src);
    }
  }
}
