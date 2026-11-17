/**
 * The extension's background page, which Owlbear keeps running for as long
 * as the room is open: it follows the characters the room knows (linked in
 * the panel, or tied to a token), keeps the tied tokens' bars and dots in
 * step with their sheets, registers the right-click entries, and passes on
 * rolls made on the sheets as notifications and into the room's roll log.
 */
import type { Sheet } from '$lib/types';
import { supabase } from '$lib/supabase';
import { campaignRepo } from '$lib/data/campaigns';
import { creatureRepo, type Creature } from '$lib/data/creatures';
import { campaignOf } from './links';
import { followSheets } from './live';
import { hearRolls } from './channel';
import { diceLine, headline, natural } from './rolls';
import { OBR, creatureLinkOf, getLinks, isKeeper, linkOf, logRoll, makeMenus, onLinks, ready, syncTokens } from './obr';
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
      await syncTokens(sheets, creatures);
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

  // ── The DM's monsters and NPCs on the map ──
  // Their numbers are the DM's alone, so only a keeper signed in (in the panel)
  // as the room's campaign's DM can read them; then they are read every few
  // seconds while any of their tokens is on the map.
  let creatures: Map<string, Creature> | null = null;
  let creatureTokens = 0;
  let creatureTimer: ReturnType<typeof setTimeout> | undefined;
  const readCreatures = async () => {
    clearTimeout(creatureTimer);
    const campaign = campaignOf(links);
    if (!keeper || !creatureTokens || !campaign) return;
    try {
      const { data } = await supabase.auth.getSession();
      const me = data.session?.user.id;
      const c = me ? await campaignRepo.get(campaign) : null;
      if (c && c.created_by === me) {
        const list = await creatureRepo.list(campaign);
        const next = new Map(list.map((x) => [x.id, x]));
        const key = (m: Map<string, Creature> | null) => JSON.stringify(m ? [...m.values()].map((x) => [x.id, x.visible, x.hp_max, x.hp_current, x.conditions]) : null);
        if (key(next) !== key(creatures)) {
          creatures = next;
          schedule();
        }
      }
    } catch {
      // Offline for a moment: the next look tries again.
    }
    creatureTimer = setTimeout(readCreatures, 4000);
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
    const items = await OBR.scene.items.getItems((i) => Boolean(linkOf(i) || creatureLinkOf(i)));
    tokenSheets = [...new Set(items.map((i) => linkOf(i)?.id).filter(Boolean) as string[])];
    const had = creatureTokens;
    creatureTokens = items.filter((i) => creatureLinkOf(i)).length;
    if (creatureTokens && !had) void readCreatures();
  };

  await readTokens().catch(() => {});
  follow();

  stops.push(
    OBR.scene.items.onChange((items) => {
      tokenSheets = [...new Set(items.map((i) => linkOf(i)?.id).filter(Boolean) as string[])];
      const had = creatureTokens;
      creatureTokens = items.filter((i) => creatureLinkOf(i)).length;
      if (creatureTokens && !had) void readCreatures();
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
      void readCreatures();
      schedule();
    }),
    onLinks((next) => {
      links = next;
      follow();
      void readCreatures();
    }),
    // Signing in or out in the panel (the same storage) changes what can be read.
    (() => {
      const { data } = supabase.auth.onAuthStateChange(() => {
        creatures = null;
        void readCreatures();
      });
      return () => data.subscription.unsubscribe();
    })()
  );

  return () => {
    clearTimeout(timer);
    clearTimeout(creatureTimer);
    stopFollow();
    stopRolls();
    stops.forEach((s) => s());
  };
}
