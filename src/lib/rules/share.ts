/**
 * The address anyone can open to read a sheet: /s?id=<id>. A sheet is
 * readable by whoever has it, and only its owner can change it.
 *
 * Not /s/<id>: the host has no file at that path and answers it with its
 * "not found" page (which the app then turns into the sheet). People see the
 * sheet either way, but a chat app reading the link for a preview sees "not
 * found" and shows no card. /s is a real page, so the preview works.
 */
export function sheetLink(origin: string, base: string, id: string): string {
  const root = origin.replace(/\/+$/, '');
  const path = base ? `/${base.replace(/^\/+|\/+$/g, '')}` : '';
  return `${root}${path}/s?id=${encodeURIComponent(id)}`;
}

/**
 * Where shared links point: the site's public address (PUBLIC_SITE_URL, the
 * Cloudflare one, whose links show a preview card), whichever address this
 * page happens to be open at. Without one set, this page's own.
 */
export function siteRoot(fallbackOrigin: string, base: string): string {
  const configured = String(import.meta.env.PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(configured)) return configured;
  const path = base ? `/${base.replace(/^\/+|\/+$/g, '')}` : '';
  return `${fallbackOrigin.replace(/\/+$/, '')}${path}`;
}
