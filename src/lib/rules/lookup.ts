/**
 * Builds 5e.tools deep links.
 *
 * The pattern, confirmed against real URLs:
 *   https://5e.tools/<category>.html#<name>_<source>
 *
 * The name is lowercased and URL-encoded; encodeURIComponent already leaves
 * parentheses and apostrophes literal, which is what 5e.tools expects.
 *
 * The source is mandatory and cannot be derived — one character spans xphb,
 * mtf and valdagunslinger. No source means no link, which is better than a
 * link that lands on nothing.
 */

export const LOOKUP_BASE = 'https://5e.tools';

export type LookupCategory =
  | 'spells'
  | 'items'
  | 'races'
  | 'feats'
  | 'backgrounds'
  | 'classes'
  | 'conditionsdiseases';

/** Sources that describe content with no page to link to. */
const UNLINKABLE = new Set(['homebrew', 'custom', 'none']);

export function lookupUrl(
  name: string,
  source: string | undefined,
  category: LookupCategory,
  override?: string
): string | null {
  if (override?.trim()) return override.trim();

  const src = source?.trim().toLowerCase();
  if (!src || UNLINKABLE.has(src)) return null;
  if (!name?.trim()) return null;

  const fragment = encodeURIComponent(name.trim().toLowerCase());
  return `${LOOKUP_BASE}/${category}.html#${fragment}_${src}`;
}

/** True when the entry should show a "Homebrew" tag rather than a link. */
export function isHomebrew(source: string | undefined): boolean {
  const src = source?.trim().toLowerCase();
  return Boolean(src && UNLINKABLE.has(src));
}
