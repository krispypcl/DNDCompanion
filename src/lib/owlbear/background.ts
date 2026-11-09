/**
 * The extension's background page, which Owlbear keeps running for as long
 * as the room is open: it follows the characters the room knows (linked in
 * the panel, or tied to a token), keeps the tied tokens' bars and dots in
 * step with their sheets, registers the right-click entries, and passes on
 * rolls made on the sheets as notifications and into the room's roll log.
 */
import type { Sheet } from '$lib/types';
import { followSheets } from './live';
import { hearRolls } from './channel';
import { diceLine, headline, natural } from './rolls';
import { OBR, getLinks, isKeeper, linkOf, logRoll, makeMenus, onLinks, ready, syncTokens } from './obr';
import type { RoomLinks } from './links';

export async function run(): Promise<() => void> {
  await ready();
  const stops: (() => void)[] = [];
  await makeMenus().catch(() => {});

  let links: RoomLinks = await getLinks().catch(() => []);
  let tokenSheets: string[] = [];
  let sheets = new Map<string, Sheet>();
  let keeper = await isKeeper().catch(() => false);
  let sceneReady = await OBR.scene.isReady().catch(() => false);

  // ── Keeping the tokens in step (one client does it) ──
  let timer: ReturnType<typeof setTimeout> | undefined;
  let busy = false;
  let again = false;
  const sync = async () => {
    if (!keeper || !sceneReady) return;
    if (busy) return void (again = true);
    busy = true;
    try {
      await syncTokens(sheets);
    } catch {
      // A player without the right to change tokens, or the scene closing: next time.
    } finally {
      busy = false;
      if (again) {
        again = false;
        schedule();
      }
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(sync, 120);
  };

  // ── Rolls from the sheets ──
  let rollKey = '';
  let stopRolls = () => {};
  const listenRolls = () => {
    const ids = [...sheets.keys()].sort();
    const key = ids.join(',');
    if (key === rollKey) return;
    rollKey = key;
    stopRolls();
    stopRolls = hearRolls(ids, (note) => {
      const nat = natural(note);
      void OBR.notification.show(`${headline(note)} · ${diceLine(note)}`, nat === 'crit' ? 'SUCCESS' : nat === 'fumble' ? 'ERROR' : 'DEFAULT');
      if (keeper) void logRoll(note).catch(() => {});
    });
  };

  // ── Which characters to follow ──
  let followKey = '';
  let stopFollow = () => {};
  const follow = () => {
    const ids = [...new Set([...links.filter((l) => l.kind === 'sheet').map((l) => l.id), ...tokenSheets])].sort();
    const camps = links.filter((l) => l.kind === 'campaign').map((l) => l.id).sort();
    const key = JSON.stringify([ids, camps]);
    if (key === followKey) return;
    followKey = key;
    stopFollow();
    stopFollow = followSheets({ sheets: ids, campaigns: camps }, (list) => {
      sheets = new Map(list.map((s) => [s.id, s]));
      listenRolls();
      schedule();
    });
  };
  const readTokens = async () => {
    if (!sceneReady) return;
    const items = await OBR.scene.items.getItems((i) => Boolean(linkOf(i)));
    tokenSheets = [...new Set(items.map((i) => linkOf(i)!.id))];
  };

  await readTokens().catch(() => {});
  follow();

  stops.push(
    OBR.scene.items.onChange((items) => {
      tokenSheets = [...new Set(items.map((i) => linkOf(i)?.id).filter(Boolean) as string[])];
      follow();
      schedule();
    }),
    OBR.scene.grid.onChange(() => schedule()),
    OBR.scene.onReadyChange(async (ok) => {
      sceneReady = ok;
      if (ok) {
        await readTokens().catch(() => {});
        follow();
        schedule();
      }
    }),
    OBR.party.onChange(async () => {
      keeper = await isKeeper().catch(() => false);
      schedule();
    }),
    onLinks((next) => {
      links = next;
      follow();
    })
  );

  return () => {
    clearTimeout(timer);
    stopFollow();
    stopRolls();
    stops.forEach((s) => s());
  };
}
