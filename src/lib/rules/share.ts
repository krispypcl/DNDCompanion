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
