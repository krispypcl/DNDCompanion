/**
 * The character's name in a font of the player's choosing, from Google
 * Fonts. Whatever they paste is understood: the font's page
 * (fonts.google.com/specimen/Cinzel+Decorative), the stylesheet link from
 * "Get embed code" (fonts.googleapis.com/css2?family=…), the whole <link>
 * or @import line, or just the font's name.
 */
export type NameFont = { family: string; href: string };

const css2 = (family: string) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`;
const clean = (family: string) => family.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
const OK = /^[A-Za-z0-9 ]{1,60}$/;

/** The font a pasted value names, null when blank, 'bad' when it names none. */
export function nameFont(raw: string | null | undefined): NameFont | null | 'bad' {
  let text = String(raw ?? '').trim();
  if (!text) return null;
  // <link href="…"> or @import url('…'): the address inside.
  const inner = text.match(/href=["']([^"']+)["']/i) ?? text.match(/@import\s+url\(\s*["']?([^"')]+)["']?\s*\)/i);
  if (inner) text = inner[1];
  text = text.replace(/&amp;/g, '&');
  if (/^(https?:)?\/\/|^fonts\.(googleapis|google)\.com/i.test(text)) {
    let url: URL;
    try {
      url = new URL(/^https?:/i.test(text) ? text : `https://${text.replace(/^\/\//, '')}`);
    } catch {
      return 'bad';
    }
    if (url.hostname === 'fonts.googleapis.com') {
      const fam = url.searchParams.getAll('family')[0];
      if (!fam) return 'bad';
      const family = clean(fam.split(':')[0]);
      if (!OK.test(family)) return 'bad';
      url.protocol = 'https:';
      if (!url.searchParams.has('display')) url.searchParams.set('display', 'swap');
      return { family, href: url.toString() };
    }
    if (url.hostname === 'fonts.google.com') {
      const spec = url.pathname.match(/\/specimen\/([^/?#]+)/);
      const family = spec ? clean(decodeURIComponent(spec[1])) : '';
      return OK.test(family) ? { family, href: css2(family) } : 'bad';
    }
    return 'bad';
  }
  const family = clean(text.replace(/^["']|["']$/g, ''));
  return OK.test(family) ? { family, href: css2(family) } : 'bad';
}

/** The font to use, or null for none (blank or unreadable). */
export function fontFace(raw: string | null | undefined): NameFont | null {
  const f = nameFont(raw);
  return f && f !== 'bad' ? f : null;
}

/** A font-family for a chosen face, falling back to the site's own. */
export const faceFamily = (f: NameFont | null | undefined): string | undefined =>
  f ? `'${f.family}', system-ui, sans-serif` : undefined;
