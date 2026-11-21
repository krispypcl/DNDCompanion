/**
 * What a 5e.tools link points at, read from the link itself, so the peek can
 * find the entry in 5e.tools' own data (rules/fiveData.ts) and show it.
 */
import type { PeekPage, PeekTarget } from './fiveData.ts';
import { morePage } from './fiveMore.ts';
export type { PeekPage, PeekTarget };

const PAGES: Record<string, PeekPage> = {
  'spells.html': 'spells',
  'items.html': 'items',
  'feats.html': 'feats',
  'races.html': 'races',
  'backgrounds.html': 'backgrounds',
  'conditionsdiseases.html': 'conditionsdiseases',
  'optionalfeatures.html': 'optionalfeatures',
  'classes.html': 'classes',
  'bestiary.html': 'bestiary'
};

/** 5e.tools' search words for a category. */
const SEARCH: Record<string, PeekPage> = {
  sp: 'spells',
  itm: 'items',
  species: 'races',
  bg: 'backgrounds',
  con: 'conditionsdiseases',
  feat: 'feats',
  class: 'classes',
  subclass: 'classes',
  bestiary: 'bestiary',
  creature: 'bestiary'
};

const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** "fireball_xphb" → name and book. */
function nameAndSource(part: string): { name: string; source: string } {
  const at = part.lastIndexOf('_');
  return at < 0 ? { name: decode(part), source: '' } : { name: decode(part.slice(0, at)), source: decode(part.slice(at + 1)) };
}

/** The entry a link points at, or null for a link that is not to 5e.tools. */
export function peekTarget(url: string): PeekTarget | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)5e\.tools$/.test(u.hostname)) return null;
  const file = u.pathname.split('/').pop() || 'index.html';

  if (file === 'search.html') {
    let q = u.searchParams.get('q') ?? '';
    let page: PeekPage = 'any';
    let source = '';
    // "source:" comes last and runs to the end; "in:" is one word.
    const src = q.match(/\bsource:(.+)$/);
    if (src) {
      source = src[1].trim().toLowerCase();
      q = q.slice(0, src.index);
    }
    const cat = q.match(/\bin:(\S+)/);
    if (cat) {
      page = SEARCH[cat[1].toLowerCase()] ?? 'any';
      q = q.replace(cat[0], '');
    }
    const name = q.replace(/\s+/g, ' ').trim();
    return name ? { page, name, source } : null;
  }

  // One of 5e.tools' other pages (rules/fiveMore): rewards, deities, languages, and the rest.
  const more = morePage(file.replace(/\.html$/, ''));
  const page = more ? 'more' : PAGES[file];
  if (!page || !u.hash) return null;
  const [head, ...rest] = u.hash.slice(1).split(',');
  const target: PeekTarget = { page, ...nameAndSource(head), ...(more ? { more: more.page } : {}) };
  const state = rest.join(',').replace(/^state:/, '');
  for (const pair of state.split('~').filter(Boolean)) {
    const [key, value = ''] = pair.split('=');
    const feature = key === 'feature' && value.match(/^s(\d+)-(\d+)$/);
    if (feature) target.feature = { level: Number(feature[1]) + 1, index: Number(feature[2]) };
    if (key.startsWith('sub_')) target.subclass = nameAndSource(key.slice(4));
  }
  return target.name ? target : null;
}
