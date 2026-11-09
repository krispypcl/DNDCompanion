/**
 * Everything that talks to Owlbear Rodeo itself: the room's links, the
 * tokens tied to sheets and what they carry, and the context menu entries.
 * Only the /owlbear pages load this (they are the extension), so the rest of
 * the site never ships the SDK.
 */
import OBR, { buildImage, buildShape, isImage, isShape, type Image, type Item, type Shape } from '@owlbear-rodeo/sdk';
import { base } from '$app/paths';
import { resolveImageUrl } from '$lib/rules/imageUrl';
import { siteRoot } from '$lib/rules/share';
import type { Sheet } from '$lib/types';
import { NS, PART_KEY, ROLLS_KEY, ROOM_KEY, SHEET_KEY, type PartLink, type TokenLink } from './keys';
import { readLinks, type RoomLinks } from './links';
import { partsFor, sameParts, tokenBox, type Part } from './layout';
import { pushNote, readLog, type RollNote } from './rolls';

export { OBR };

/** Waits for Owlbear to be ready; never resolves outside Owlbear. */
export function ready(): Promise<typeof OBR> {
  return new Promise((resolve) => {
    if (!OBR.isAvailable) return;
    if (OBR.isReady) return resolve(OBR);
    OBR.onReady(() => resolve(OBR));
    // Owlbear's "ready" may have come before this code did (app.html kept it).
    const early = (window as unknown as { __obrReady?: { data: unknown; origin: string } }).__obrReady;
    if (early) window.dispatchEvent(new MessageEvent('message', { data: early.data, origin: early.origin }));
  });
}

/** Where this site's own files are, absolute (Owlbear wants whole addresses). */
export const asset = (path: string) => `${location.origin}${base}/owlbear/${path}`;
/** A sheet's public address, for opening it. */
export const sheetUrl = (id: string) => `${siteRoot(location.origin, base)}/s?id=${encodeURIComponent(id)}`;
/** A campaign's page. */
export const campaignUrl = (id: string) => `${siteRoot(location.origin, base)}/c?id=${encodeURIComponent(id)}`;
/** The picture a sheet's token wears: its portrait, else the site's die. */
export function portraitOf(sheet: Sheet): string {
  const url = resolveImageUrl(sheet.definition?.identity?.portraitUrl).url;
  return url || `${siteRoot(location.origin, base)}/icon-512.png`;
}
export const nameOf = (s: Sheet) => s.definition?.identity?.name || s.name || 'Unnamed';

// ── The room's links ──
export async function getLinks(): Promise<RoomLinks> {
  return readLinks((await OBR.room.getMetadata())[ROOM_KEY]);
}
/** Plain data only crosses to Owlbear: a page's reactive copies (Svelte's
    proxies) cannot be posted, which once made every link after the first
    fail to save. */
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
export async function setLinks(links: RoomLinks): Promise<void> {
  await OBR.room.setMetadata({ [ROOM_KEY]: plain(links) });
}
export function onLinks(cb: (links: RoomLinks) => void): () => void {
  return OBR.room.onMetadataChange((m) => cb(readLinks(m[ROOM_KEY])));
}
export async function getRolls(): Promise<RollNote[]> {
  return readLog((await OBR.room.getMetadata())[ROLLS_KEY]);
}
export function onRolls(cb: (log: RollNote[]) => void): () => void {
  return OBR.room.onMetadataChange((m) => cb(readLog(m[ROLLS_KEY])));
}
export async function logRoll(note: RollNote): Promise<void> {
  const log = readLog((await OBR.room.getMetadata())[ROLLS_KEY]);
  const next = pushNote(log, note);
  if (next !== log) await OBR.room.setMetadata({ [ROLLS_KEY]: next });
}

/**
 * One client looks after the tokens' bars, so they are not written by
 * everyone at once: a GM if one is here, else whoever joined first.
 */
export async function isKeeper(): Promise<boolean> {
  const [me, role, party] = await Promise.all([OBR.player.getConnectionId(), OBR.player.getRole(), OBR.party.getPlayers()]);
  const all = [{ connectionId: me, role }, ...party.map((p) => ({ connectionId: p.connectionId, role: p.role }))];
  const gms = all.filter((p) => p.role === 'GM');
  const pool = (gms.length ? gms : all).map((p) => p.connectionId).sort();
  return pool[0] === me;
}

// ── Tokens ──
export const linkOf = (item: Item): TokenLink | null => {
  const v = item.metadata?.[SHEET_KEY] as TokenLink | undefined;
  return v && typeof v.id === 'string' ? v : null;
};
const partOf = (item: Item): PartLink | null => {
  const v = item.metadata?.[PART_KEY] as PartLink | undefined;
  return v && typeof v.token === 'string' && typeof v.kind === 'string' ? v : null;
};

/** A picture's size and type, by loading it. */
export function imageInfo(url: string): Promise<{ width: number; height: number; mime: string }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const ext = (new URL(url, location.href).pathname.split('.').pop() ?? '').toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
      resolve({ width: img.naturalWidth || 512, height: img.naturalHeight || 512, mime });
    };
    img.onerror = () => reject(new Error('That portrait wouldn’t load into the map! Its host may not share pictures with other sites.'));
    img.src = url;
  });
}

/** A new token for a sheet, wearing its portrait, in the middle of the view. */
export async function placeToken(sheet: Sheet): Promise<string> {
  const url = portraitOf(sheet);
  const info = await imageInfo(url);
  const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const centre = await OBR.viewport.inverseTransformPoint({ x: w / 2, y: h / 2 });
  const at = await OBR.scene.grid.snapPosition(centre);
  const size = Math.min(info.width, info.height);
  const token = buildImage(
    { url, width: info.width, height: info.height, mime: info.mime },
    { dpi: size, offset: { x: info.width / 2, y: info.height / 2 } }
  )
    .name(nameOf(sheet))
    .plainText(nameOf(sheet))
    .textItemType('LABEL')
    .layer('CHARACTER')
    .position(at)
    .metadata({ [SHEET_KEY]: { id: sheet.id, portrait: url } satisfies TokenLink })
    .build();
  await OBR.scene.items.addItems([token]);
  return token.id;
}

/** Ties a token on the map to a sheet; it takes on the sheet's portrait. */
export async function tieToken(itemId: string, sheet: Sheet): Promise<void> {
  const url = portraitOf(sheet);
  const hasPortrait = Boolean(resolveImageUrl(sheet.definition?.identity?.portraitUrl).url);
  const info = hasPortrait ? await imageInfo(url).catch(() => null) : null;
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) {
      d.metadata[SHEET_KEY] = { id: sheet.id, ...(info ? { portrait: url } : {}) } satisfies TokenLink;
      if (info && isImage(d as Item)) swapPicture(d as unknown as Image, url, info);
    }
  });
}

/** A new picture for a token, the same size on the map as before. */
function swapPicture(d: Image, url: string, info: { width: number; height: number; mime: string }) {
  // Keep the token the same number of grid cells across as it was.
  const across = Math.max(0.01, d.image.width / (d.grid.dpi || d.image.width));
  d.image = { url, width: info.width, height: info.height, mime: info.mime };
  d.grid = { dpi: info.width / across, offset: { x: info.width / 2, y: info.height / 2 } };
}

export async function untieToken(itemId: string): Promise<void> {
  const parts = (await OBR.scene.items.getItems((i) => partOf(i)?.token === itemId)).map((i) => i.id);
  if (parts.length) await OBR.scene.items.deleteItems(parts);
  await OBR.scene.items.updateItems([itemId], (drafts) => {
    for (const d of drafts) delete d.metadata[SHEET_KEY];
  });
}

function shapeToPart(s: Shape, kind: Part['kind']): Part {
  const circle = s.shapeType === 'CIRCLE';
  return {
    kind, shape: circle ? 'CIRCLE' : 'RECTANGLE', x: s.position.x, y: s.position.y, w: s.width, h: s.height,
    fill: s.style.fillColor, opacity: s.style.fillOpacity, stroke: s.style.strokeColor, strokeWidth: s.style.strokeWidth, z: s.zIndex
  };
}

function buildPart(token: Item, p: Part): Shape {
  return buildShape()
    .shapeType(p.shape)
    .width(p.w)
    .height(p.h)
    .position({ x: p.x, y: p.y })
    .fillColor(p.fill)
    .fillOpacity(p.opacity)
    .strokeColor(p.stroke)
    .strokeWidth(p.strokeWidth)
    .strokeOpacity(p.strokeWidth > 0 ? 1 : 0)
    .layer('ATTACHMENT')
    .attachedTo(token.id)
    .locked(true)
    .disableHit(true)
    .disableAutoZIndex(true)
    .zIndex(p.z)
    // It moves with the token, but its size is worked out again when the
    // token's changes, and a copied token gets its own.
    .disableAttachmentBehavior(['SCALE', 'ROTATION', 'COPY'])
    .name('DND Companion')
    .metadata({ [PART_KEY]: { token: token.id, kind: p.kind } satisfies PartLink })
    .build();
}

const swapping = new Set<string>();

/**
 * Brings every tied token's bar and condition dots in line with its sheet:
 * adds what is missing, moves or recolours what changed, takes away what is
 * no longer wanted. Parts of a token whose sheet has not been read yet are
 * left alone. A changed portrait is put on the token too.
 */
export async function syncTokens(sheets: Map<string, Sheet>): Promise<void> {
  const [items, dpi] = await Promise.all([OBR.scene.items.getItems(), OBR.scene.grid.getDpi()]);
  const tokens = new Map<string, Image>();
  for (const i of items) if (isImage(i) && linkOf(i)) tokens.set(i.id, i);

  const want = new Map<string, { token: Image; part: Part }>();
  const known = new Set<string>();
  for (const t of tokens.values()) {
    const sheet = sheets.get(linkOf(t)!.id);
    if (!sheet) continue;
    known.add(t.id);
    for (const part of partsFor(tokenBox(t, dpi), sheet)) want.set(`${t.id}|${part.kind}`, { token: t, part });
  }

  const have = new Map<string, Shape>();
  const extra: string[] = [];
  for (const i of items) {
    const p = partOf(i);
    if (!p) continue;
    const key = `${p.token}|${p.kind}`;
    const tokenGone = !tokens.has(p.token) || i.attachedTo !== p.token;
    if (tokenGone || !isShape(i) || have.has(key) || (known.has(p.token) && !want.has(key))) extra.push(i.id);
    else have.set(key, i);
  }

  const changes = new Map<string, Part>();
  const add: Item[] = [];
  for (const [key, { token, part }] of want) {
    const cur = have.get(key);
    if (!cur) add.push(buildPart(token, part));
    else if (!sameParts(shapeToPart(cur, part.kind), part) || cur.zIndex !== part.z) changes.set(cur.id, part);
  }
  if (extra.length) await OBR.scene.items.deleteItems(extra);
  if (changes.size)
    await OBR.scene.items.updateItems([...changes.keys()], (drafts) => {
      for (const d of drafts) {
        const p = changes.get(d.id);
        if (!p || !isShape(d as Item)) continue;
        const s = d as unknown as Shape;
        s.position = { x: p.x, y: p.y };
        s.width = p.w;
        s.height = p.h;
        s.zIndex = p.z;
        s.style = { ...s.style, fillColor: p.fill, fillOpacity: p.opacity, strokeColor: p.stroke, strokeWidth: p.strokeWidth, strokeOpacity: p.strokeWidth > 0 ? 1 : 0 };
      }
    });
  if (add.length) await OBR.scene.items.addItems(add);

  // A portrait changed on the sheet: the token tied with the old one follows.
  for (const t of tokens.values()) {
    const link = linkOf(t)!;
    const sheet = sheets.get(link.id);
    if (!sheet || !link.portrait || swapping.has(t.id)) continue;
    const url = resolveImageUrl(sheet.definition?.identity?.portraitUrl).url;
    if (!url || url === link.portrait) continue;
    swapping.add(t.id);
    imageInfo(url)
      .then((info) =>
        OBR.scene.items.updateItems([t.id], (drafts) => {
          for (const d of drafts) {
            swapPicture(d as unknown as Image, url, info);
            d.metadata[SHEET_KEY] = { id: link.id, portrait: url } satisfies TokenLink;
          }
        })
      )
      .catch(() => {})
      .finally(() => swapping.delete(t.id));
  }
}

/** The right-click entries: hit points, tying a token to a character, untying it. */
export async function makeMenus(): Promise<void> {
  const tied = { key: ['metadata', SHEET_KEY], value: undefined, operator: '!=' as const };
  const untied = { key: ['metadata', SHEET_KEY], value: undefined };
  await OBR.contextMenu.create({
    id: `${NS}/hp`,
    icons: [{ icon: asset('heart.svg'), label: 'Hit points', filter: { max: 1, every: [tied] } }],
    embed: { url: asset('hp'), height: 176 }
  });
  await OBR.contextMenu.create({
    id: `${NS}/tie`,
    icons: [{ icon: asset('link.svg'), label: 'Tie to a character', filter: { max: 1, every: [{ key: 'layer', value: 'CHARACTER' }, untied] } }],
    embed: { url: asset('link'), height: 230 }
  });
  await OBR.contextMenu.create({
    id: `${NS}/untie`,
    icons: [{ icon: asset('unlink.svg'), label: 'Untie from the character', filter: { max: 1, every: [tied] } }],
    onClick: (ctx) => {
      const item = ctx.items[0];
      if (item) void untieToken(item.id);
    }
  });
}

/** The page follows Owlbear's light or dark. */
export async function followTheme(apply: (mode: 'light' | 'dark') => void): Promise<() => void> {
  apply((await OBR.theme.getTheme()).mode === 'LIGHT' ? 'light' : 'dark');
  return OBR.theme.onChange((t) => apply(t.mode === 'LIGHT' ? 'light' : 'dark'));
}
