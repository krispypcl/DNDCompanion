/**
 * Who is at the table right now, in one line, the same on the campaign page
 * and the main menu: "DM and 3 players here", "DM here", "1 player here",
 * or nothing when nobody is.
 */
export function hereText(dm: boolean, players: number): string {
  const who = [dm ? 'DM' : '', players > 0 ? (players === 1 ? '1 player' : `${players} players`) : ''].filter(Boolean);
  return who.length ? `${who.join(' and ')} here` : '';
}

/** A link that opens somewhere else, kept only when it is a web address (an Owlbear Rodeo room, say). */
export function webLink(raw: string | undefined | null): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}
