/**
 * The theme each sheet and campaign was last seen in, kept on this device,
 * so a page loading on a phone can wear its own colors from the first frame
 * (its bars, its outline, its die) instead of the default ones first. Written
 * whenever a sheet or a campaign loads, and for every card the main menu
 * lists; read only while a page is still loading.
 */
const KEY = 'dndcompanion:themes';
/** Enough for any table; the oldest are let go first. */
const MOST = 200;

function read(): Record<string, string> {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return kept && typeof kept === 'object' ? kept : {};
  } catch {
    return {};
  }
}

/** The theme last seen on this sheet or campaign, if any. */
export function rememberedTheme(id: string): string | undefined {
  const value = read()[id];
  return typeof value === 'string' ? value : undefined;
}

/** Keeps the themes seen (id, theme), in one write for all of them. */
export function rememberThemes(seen: Iterable<[string, unknown]>) {
  const kept = read();
  let changed = false;
  for (const [id, theme] of seen) {
    if (!id || typeof theme !== 'string' || kept[id] === theme) continue;
    delete kept[id]; // Moved to the end: the newest stay longest.
    kept[id] = theme;
    changed = true;
  }
  if (!changed) return;
  const ids = Object.keys(kept);
  for (const id of ids.slice(0, Math.max(0, ids.length - MOST))) delete kept[id];
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // A private window can refuse; the page loads in the default colors then.
  }
}
