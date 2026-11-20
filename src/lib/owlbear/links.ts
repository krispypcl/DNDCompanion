/**
 * The room's campaign: what the DM pastes into the Owlbear panel (the
 * campaign page's link, or its invite), kept in the room's metadata as a
 * one-item list (the shape rooms have always stored).
 */
export type RoomLink = { kind: 'sheet' | 'campaign'; id: string };

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * The campaign or sheet a pasted link names, or null. A bare id is taken as
 * a campaign's; a sheet's link is told apart only to say it's the wrong one.
 */
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
  return bare ? { kind: 'campaign', id: bare[0].toLowerCase() } : null;
}

/**
 * The campaign a room's stored list names: the latest one. Characters once
 * added on their own (before rooms held only a campaign) are left behind.
 */
export function readCampaign(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const v of [...value].reverse()) {
    const id = String((v as RoomLink)?.id ?? '');
    if ((v as RoomLink)?.kind === 'campaign' && new RegExp(`^${UUID.source}$`, 'i').test(id)) return id.toLowerCase();
  }
  return null;
}

/** What the room stores for its campaign. */
export const roomValue = (campaignId: string): RoomLink[] => [{ kind: 'campaign', id: campaignId }];

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
