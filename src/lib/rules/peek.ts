/**
 * Where an entry's text sits on a 5e.tools page, so the peek window can show
 * that and nothing else. A page is shown in a frame as wide as a desktop
 * (FRAME_WIDTH), where 5e.tools always puts its list on the left and the
 * chosen entry in a panel on the right; the window is a hole cut over that
 * panel. Measured on 5e.tools (16 Nov 2026). If 5e.tools changes its layout,
 * these numbers are the ones to measure again.
 */
export const FRAME_WIDTH = 1400;
/** The panel's right edge on every list page. */
const PANEL_RIGHT = 1263;
/** Its top: under the advert band 5e.tools keeps for frames (250) and its header. */
const PANEL_TOP = 355;
/** Room 5e.tools keeps under the panel (a band at the foot of the page). */
export const PANEL_FOOT = 190;

/** Where each list page's panel starts (the lists differ in width). */
const PANEL_LEFT: Record<string, number> = {
  'spells.html': 800,
  'items.html': 818,
  'optionalfeatures.html': 818,
  'feats.html': 758,
  'races.html': 707,
  'backgrounds.html': 707,
  'conditionsdiseases.html': 707
};
/** A page we don't know, or a search that lands on one: the widest panel, so nothing is cut. */
const WIDEST = 707;

/** 5e.tools' search words for a category, to the page a lucky search lands on. */
const SEARCH_PAGE: Record<string, string> = {
  sp: 'spells.html',
  itm: 'items.html',
  species: 'races.html',
  bg: 'backgrounds.html',
  con: 'conditionsdiseases.html',
  feat: 'feats.html',
  class: 'classes.html',
  subclass: 'classes.html'
};

export type Crop = {
  /** Left and top of the hole, in the frame's own pixels. */
  x: number;
  y: number;
  /** Its width in the frame's pixels. */
  width: number;
  /** A class page scrolls as a whole and keeps its feature at the top of the frame. */
  wholePage: boolean;
};

/** Which 5e.tools page a link opens (for a search, the page it is narrowed to). */
export function peekPage(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)5e\.tools$/.test(u.hostname)) return null;
  const file = u.pathname.split('/').pop() || 'index.html';
  if (file !== 'search.html') return file;
  const q = u.searchParams.get('q') ?? '';
  const cat = q.match(/\bin:(\S+)/)?.[1];
  return (cat && SEARCH_PAGE[cat]) || null;
}

/** The hole to cut for a link, or null for a link that is not to 5e.tools. */
export function peekCrop(url: string): Crop | null {
  if (!/^https:\/\/([a-z0-9-]+\.)?5e\.tools\//i.test(url)) return null;
  const page = peekPage(url);
  if (page === 'classes.html') return { x: 423, y: 0, width: 825, wholePage: true };
  const left = (page ? PANEL_LEFT[page] : undefined) ?? WIDEST;
  return { x: left, y: PANEL_TOP, width: PANEL_RIGHT - left, wholePage: false };
}
