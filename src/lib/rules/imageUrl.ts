/**
 * Turning the link someone pasted into an address a page can show.
 *
 * What people copy is rarely the picture. A Drive link opens a viewer, an
 * Imgur link opens a page, a Pinterest link opens a pin. A browser's <img>
 * needs the file itself. Where the picture's address can be worked out from
 * the link it is, here, without asking any service; where it cannot, the
 * answer is a plain sentence about what to copy instead.
 *
 * The sheet stores what was pasted and resolves it when drawing, so the field
 * always shows what the person put in, and a rule fixed here fixes every
 * sheet that already has one.
 */

export type ImageSource = 'none' | 'direct' | 'drive' | 'imgur' | 'pinterest' | 'invalid';

export type ResolvedImage = {
  /** Safe to put in an <img src>, or empty when there is nothing to show. */
  url: string;
  source: ImageSource;
  /** One sentence for the person editing: what was recognised, or what to do. */
  note: string | null;
};

const none: ResolvedImage = { url: '', source: 'none', note: null };
const invalid = (note: string): ResolvedImage => ({ url: '', source: 'invalid', note });

const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
const IMGUR_ID = /^[A-Za-z0-9]{5,9}$/;

function parse(raw: string): URL | null {
  // "imgur.com/abc" with no scheme is a link to anyone who typed it.
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function driveId(url: URL): string | null {
  const inPath = url.pathname.match(/\/d\/([^/]+)/)?.[1];
  const id = inPath ?? url.searchParams.get('id');
  return id && DRIVE_ID.test(id) ? id : null;
}

export function resolveImageUrl(input: string | null | undefined): ResolvedImage {
  const raw = (input ?? '').trim();
  if (!raw) return none;

  const url = parse(raw);
  if (!url) return invalid('That does not look like a web address.');

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  // Google Drive. The viewer page is no use in <img>; the file's own address
  // is, for a file shared as "Anyone with the link".
  if (host === 'drive.google.com' || host === 'docs.google.com') {
    if (/\/folders\//.test(url.pathname)) {
      return invalid('That is a Drive folder. Share one picture and copy its link instead.');
    }
    const id = driveId(url);
    if (!id) return invalid('That Drive link does not name a file. Use the file’s Share link.');
    return {
      url: `https://lh3.googleusercontent.com/d/${id}`,
      source: 'drive',
      note: 'Google Drive link. The file has to be shared as “Anyone with the link”.'
    };
  }

  if (host === 'imgur.com' || host === 'm.imgur.com') {
    const [first] = url.pathname.split('/').filter(Boolean);
    if (!first) return invalid('That Imgur link does not name a picture.');
    if (['a', 'gallery', 't', 'r', 'user'].includes(first)) {
      return invalid(
        'That is an Imgur album or gallery. Open the picture, right-click it and copy its image address.'
      );
    }
    const [id, ext] = first.split('.');
    if (!IMGUR_ID.test(id)) return invalid('That Imgur link does not name a picture.');
    return { url: `https://i.imgur.com/${id}.${ext || 'jpg'}`, source: 'imgur', note: null };
  }
  if (host === 'i.imgur.com') {
    return { url: url.toString(), source: 'imgur', note: null };
  }

  // Pinterest: the pin is a page; only the file on pinimg.com is a picture.
  if (host.endsWith('pinimg.com')) {
    return { url: url.toString(), source: 'pinterest', note: null };
  }
  if (/(^|\.)pinterest\.[a-z.]+$/.test(host) || host === 'pin.it') {
    return invalid(
      'That is a Pinterest page, not the picture. Open the pin, right-click the image and choose “Copy image address”.'
    );
  }

  return { url: url.toString(), source: 'direct', note: null };
}

/**
 * Where to look for a picture on Pinterest. Their API does not offer pin
 * search and their terms forbid fetching pins automatically, so the sheet
 * does not try: it opens Pinterest's own search, in the person's own
 * browser, and the person copies the picture's address back.
 */
export function pinterestSearchUrl(terms: string): string {
  const q = terms.trim().replace(/\s+/g, ' ');
  return `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(q)}&rs=typed`;
}

export type ImageRole = 'portrait' | 'banner';

/** What to look for, from what the sheet already says about the character. */
export function pinterestTerms(
  role: ImageRole,
  identity: { ancestry?: string; class?: string; name?: string }
): string {
  const who = [identity.ancestry, identity.class].map((s) => s?.trim()).filter(Boolean).join(' ');
  return role === 'portrait'
    ? [who, 'dnd character portrait art'].filter(Boolean).join(' ')
    : [who, 'fantasy wide banner wallpaper'].filter(Boolean).join(' ');
}
