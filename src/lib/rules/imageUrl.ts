/**
 * Turning the link someone pasted into an address a page can show.
 *
 * What people copy is rarely the picture. A Drive link opens a viewer, an
 * Imgur link opens a page, a Dropbox link opens a preview. A browser's <img>
 * needs the file itself. Where the picture's address can be worked out from
 * the link alone, it is, here, without asking any service. Where it cannot —
 * a Pinterest pin, an ArtStation page — the answer is one plain sentence on
 * what to copy instead.
 *
 * The sheet stores what was pasted and resolves it when drawing, so the field
 * always shows what the person put in, and a rule fixed here fixes every
 * sheet that already has one.
 */

export type ImageSource =
  | 'none'
  | 'direct'
  | 'drive'
  | 'dropbox'
  | 'onedrive'
  | 'github'
  | 'imgur'
  | 'pinterest'
  | 'gyazo'
  | 'google'
  | 'invalid';

export type ResolvedImage = {
  /** Safe to put in an <img src>, or empty when there is nothing to show. */
  url: string;
  source: ImageSource;
  /** One sentence for the person editing: what was recognised, or what to do. */
  note: string | null;
};

const none: ResolvedImage = { url: '', source: 'none', note: null };
const invalid = (note: string): ResolvedImage => ({ url: '', source: 'invalid', note });
const ok = (url: string, source: ImageSource, note: string | null = null): ResolvedImage => ({ url, source, note });

const COPY_ADDRESS = 'right-click the picture (or long-press it on a phone) and copy its image address';

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

/** OneDrive's documented way to reach a shared file: the share link, base64url'd. */
function oneDriveContent(link: string): string {
  const bytes = new TextEncoder().encode(link);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  const encoded = btoa(binary).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return `https://api.onedrive.com/v1.0/shares/u!${encoded}/root/content`;
}

/** Sites whose links are pages, never pictures, and cannot be turned into one offline. */
const PAGE_ONLY: { test: (host: string) => boolean; name: string }[] = [
  { test: (h) => /(^|\.)pinterest\.[a-z.]+$/.test(h) || h === 'pin.it', name: 'a Pinterest pin' },
  { test: (h) => h === 'artstation.com', name: 'an ArtStation page' },
  { test: (h) => h === 'deviantart.com' || h.endsWith('.deviantart.com'), name: 'a DeviantArt page' },
  { test: (h) => h === 'flickr.com' || h === 'flic.kr', name: 'a Flickr page' },
  { test: (h) => h === 'ibb.co', name: 'an ImgBB page' },
  { test: (h) => h === 'postimg.cc' || h === 'postimages.org', name: 'a Postimages page' },
  { test: (h) => h === 'photos.app.goo.gl' || h === 'photos.google.com', name: 'a Google Photos page' },
  { test: (h) => h === 'reddit.com' || h === 'old.reddit.com' || h === 'redd.it', name: 'a Reddit post' },
  { test: (h) => h === 'x.com' || h === 'twitter.com', name: 'a post on X' },
  { test: (h) => h === 'instagram.com', name: 'an Instagram post' },
  { test: (h) => h === 'tumblr.com' || /\.tumblr\.com$/.test(h) && !/media\.tumblr\.com$/.test(h), name: 'a Tumblr post' },
  { test: (h) => h === 'canva.com', name: 'a Canva design' }
];

export function resolveImageUrl(input: string | null | undefined): ResolvedImage {
  const raw = (input ?? '').trim();
  if (!raw) return none;

  const url = parse(raw);
  if (!url) return invalid('That doesn’t look like a web address!');

  const host = url.hostname.toLowerCase().replace(/^www\./, '');

  // A Google Images result carries the picture's own address inside it.
  if ((host === 'google.com' || /^google\.[a-z.]+$/.test(host)) && url.pathname === '/imgres') {
    const inner = url.searchParams.get('imgurl');
    if (inner) {
      const resolved = resolveImageUrl(inner);
      return resolved.source === 'invalid' ? resolved : ok(resolved.url, 'google');
    }
  }

  // Google Drive. The viewer page is no use in <img>; the file's own address
  // is, for a file shared as "Anyone with the link".
  if (host === 'drive.google.com' || host === 'docs.google.com' || host === 'drive.usercontent.google.com') {
    if (/\/folders\//.test(url.pathname)) {
      return invalid('That’s a whole Drive folder! Share one picture and copy its link instead.');
    }
    const id = driveId(url);
    if (!id) return invalid('That Drive link doesn’t point at a file! Use the file’s Share link.');
    return ok(
      `https://lh3.googleusercontent.com/d/${id}`,
      'drive',
      'Google Drive link. The file has to be shared as “Anyone with the link”.'
    );
  }

  // Dropbox: the same link, asking for the file rather than the preview.
  if (host === 'dropbox.com' || host === 'dl.dropbox.com' || host === 'dl.dropboxusercontent.com') {
    if (/^\/(s|scl|sh)\//.test(url.pathname)) {
      const file = new URL(url.toString());
      file.hostname = 'www.dropbox.com';
      file.searchParams.delete('dl');
      file.searchParams.set('raw', '1');
      return ok(file.toString(), 'dropbox');
    }
    if (host !== 'dropbox.com') return ok(url.toString(), 'dropbox');
    return invalid('That Dropbox link isn’t a shared file! Use Share → Copy link on the picture.');
  }

  // OneDrive share links, long or short.
  if (host === '1drv.ms' || host === 'onedrive.live.com') {
    return ok(oneDriveContent(url.toString()), 'onedrive', 'OneDrive link. The file has to be shared with anyone who has the link.');
  }

  // GitHub: the page around a file, or the file itself.
  if (host === 'github.com') {
    const m = url.pathname.match(/^\/([^/]+)\/([^/]+)\/(?:blob|raw)\/(.+)$/);
    if (m) return ok(`https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`, 'github');
  }

  if (host === 'imgur.com' || host === 'm.imgur.com') {
    const [first] = url.pathname.split('/').filter(Boolean);
    if (!first) return invalid('That Imgur link doesn’t point at a picture!');
    if (['a', 'gallery', 't', 'r', 'user'].includes(first)) {
      return invalid(`That’s an Imgur album or gallery! Open the picture, ${COPY_ADDRESS}.`);
    }
    const [id, ext] = first.split('.');
    if (!IMGUR_ID.test(id)) return invalid('That Imgur link doesn’t point at a picture!');
    return ok(`https://i.imgur.com/${id}.${ext || 'jpg'}`, 'imgur');
  }
  if (host === 'i.imgur.com') return ok(url.toString(), 'imgur');

  // Pinterest's own picture files. A thumbnail size is swapped for the
  // largest one every pin has, so a banner is not a blown-up thumbnail.
  if (host.endsWith('pinimg.com')) {
    const sharp = url.toString().replace(/\/(?:60x60|75x75|136x136|170x|236x|474x|564x)\//, '/736x/');
    return ok(sharp, 'pinterest');
  }

  // Gyazo: the page's ID is the file's name.
  if (host === 'gyazo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (id && /^[a-f0-9]{32}$/i.test(id)) return ok(`https://i.gyazo.com/${id}.png`, 'gyazo');
  }

  if (host === 'cdn.discordapp.com' || host === 'media.discordapp.net') {
    return ok(url.toString(), 'direct', 'Discord links stop working after about a day. Host the picture somewhere lasting.');
  }

  const page = PAGE_ONLY.find((p) => p.test(host));
  if (page) {
    return invalid(`That’s ${page.name}, not the picture itself! Open it, ${COPY_ADDRESS}, and paste that here.`);
  }

  return ok(url.toString(), 'direct');
}
