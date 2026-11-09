/**
 * What a player pastes into the Owlbear panel to bring characters into the
 * room: a sheet's link, a campaign's (every character in it), or just the id.
 */
export type RoomLink = { kind: 'sheet' | 'campaign'; id: string };
export type RoomLinks = RoomLink[];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The sheet or campaign a pasted link or id names, or null. */
export function parseLink(raw: string): RoomLink | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  let url: URL | null = null;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://x.invalid/${text.replace(/^\/+/, '')}`);
  } catch {
    url = null;
  }
  if (url) {
    // /s/<id>, /s?id=<id>, /c/<id>, /c?id=<id>, under whatever base path.
    const m = url.pathname.match(/\/(s|c)(?:\/([^/?#]+))?\/?$/i);
    const id = (m?.[2] ?? url.searchParams.get('id') ?? '').match(UUID)?.[0];
    if (m && id) return { kind: m[1].toLowerCase() === 'c' ? 'campaign' : 'sheet', id: id.toLowerCase() };
  }
  const bare = text.match(new RegExp(`^${UUID.source}$`, 'i'));
  return bare ? { kind: 'sheet', id: bare[0].toLowerCase() } : null;
}

/** The links as stored, cleaned: known kinds, real ids, no repeats. */
export function readLinks(value: unknown): RoomLinks {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: RoomLinks = [];
  for (const v of value) {
    const kind = (v as RoomLink)?.kind;
    const id = String((v as RoomLink)?.id ?? '');
    if ((kind !== 'sheet' && kind !== 'campaign') || !UUID.test(id) || seen.has(`${kind}:${id}`)) continue;
    seen.add(`${kind}:${id}`);
    out.push({ kind, id });
  }
  return out;
}

export function addLink(links: RoomLinks, link: RoomLink): RoomLinks {
  return links.some((l) => l.kind === link.kind && l.id === link.id) ? links : [...links, link];
}

export function removeLink(links: RoomLinks, link: RoomLink): RoomLinks {
  return links.filter((l) => !(l.kind === link.kind && l.id === link.id));
}
