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
  // Rooms from before one campaign per room: the latest one stays.
  const camps = out.filter((l) => l.kind === 'campaign');
  return camps.length > 1 ? out.filter((l) => l.kind !== 'campaign' || l === camps[camps.length - 1]) : out;
}

/**
 * A room has one campaign: adding a campaign puts it in place of the one
 * there (a character added on its own stays).
 */
export function addLink(links: RoomLinks, link: RoomLink): RoomLinks {
  if (links.some((l) => l.kind === link.kind && l.id === link.id)) return links;
  if (link.kind === 'campaign') return [...links.filter((l) => l.kind !== 'campaign'), link];
  return [...links, link];
}

/** The room's campaign, if it has one. */
export const campaignOf = (links: RoomLinks): string | null => links.find((l) => l.kind === 'campaign')?.id ?? null;

/** The order to show characters in: the DM's for the room, then the campaign's, then by name. */
export function orderSheets<T extends { id: string; name?: string | null }>(sheets: T[], roomOrder: string[], campaignOrder: string[] = []): T[] {
  const rank = (id: string) => {
    const r = roomOrder.indexOf(id);
    if (r >= 0) return r;
    const c = campaignOrder.indexOf(id);
    return c >= 0 ? 10000 + c : 20000;
  };
  return [...sheets].sort((a, b) => rank(a.id) - rank(b.id) || String(a.name ?? '').localeCompare(String(b.name ?? '')));
}

export function removeLink(links: RoomLinks, link: RoomLink): RoomLinks {
  return links.filter((l) => !(l.kind === link.kind && l.id === link.id));
}
