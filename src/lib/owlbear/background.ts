/**
 * The extension's background page, which Owlbear keeps running for as long
 * as the room is open: it follows the room's campaign and any character tied
 * to a token, keeps the tied tokens' bars and dots in step with their sheets
 * (and the DM's creatures' with theirs), registers the right-click entries,
 * and shows rolls made on the sheets as pop-ups for everyone in the room.
 * Everything arrives live (Supabase Realtime); nothing is asked again on a
 * timer.
 */
import type { Sheet } from '#lib/types.ts';
import { supabase } from '#lib/supabase.ts';
import { campaignRepo } from '#lib/data/campaigns.ts';
import { followCreatures, type Creature } from '#lib/data/creatures.ts';
import { followSheets } from './live';
import { hearRolls } from './channel';
import { diceLine, headline, natural } from './rolls';
import { OBR, clearOldRolls, creatureLinkOf, getCampaign, isKeeper, linkOf, makeMenus, onCampaign, ready, syncTokens } from './obr';

export async function run(): Promise<() => void> {
  await ready();
  const stops: (() => void)[] = [];
  await makeMenus().catch(() => {});

  let campaign = await getCampaign().catch(() => null);
  let tokenSheets: string[] = [];
  let sheets = new Map<string, Sheet>();
  let keeper = await isKeeper().catch(() => false);
  let sceneReady = await OBR.scene.isReady().catch(() => false);
  if (keeper) void clearOldRolls().catch(() => {});

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
  // as the room's campaign's DM follows them, and only while one of their
  // tokens is on the map.
  let creatures: Map<string, Creature> | null = null;
  let creatureTokens = 0;
  let creatureKey = '';
  let stopCreatures = () => {};
  let asked = 0;
  const watchCreatures = async () => {
    const turn = ++asked;
    const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const me = data.session?.user.id ?? null;
    const c = keeper && creatureTokens && campaign && me ? await campaignRepo.get(campaign).catch(() => null) : null;
    const key = c && c.created_by === me ? `${c.id}|${me}` : '';
    // A newer look (signing in, the campaign replaced) answers instead.
    if (turn !== asked || key === creatureKey) return;
    creatureKey = key;
    stopCreatures();
    stopCreatures = () => {};
    creatures = null;
    if (!key) return;
    let shown = '';
    stopCreatures = followCreatures(c!.id, (list) => {
      // Only what the tokens show: a note or a roll for initiative leaves them be.
      const next = JSON.stringify(list.map((x) => [x.id, x.visible, x.hp_max, x.hp_current, x.conditions, x.condition_looks]));
      if (next === shown && creatures) return;
      shown = next;
      creatures = new Map(list.map((x) => [x.id, x]));
      schedule();
    });
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
    });
  };

  // ── Which characters to follow: the campaign's, and any tied to a token ──
  let followKey = '';
  let stopFollow = () => {};
  const follow = () => {
    const ids = [...new Set(tokenSheets)].sort();
    const camps = campaign ? [campaign] : [];
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
  const readTokens = (items: Parameters<typeof linkOf>[0][]) => {
    tokenSheets = [...new Set(items.map((i) => linkOf(i)?.id).filter(Boolean) as string[])];
    const had = creatureTokens;
    creatureTokens = items.filter((i) => creatureLinkOf(i)).length;
    if (Boolean(creatureTokens) !== Boolean(had)) void watchCreatures();
  };

  if (sceneReady) readTokens(await OBR.scene.items.getItems().catch(() => []));
  follow();

  stops.push(
    OBR.scene.items.onChange((items) => {
      readTokens(items);
      follow();
      schedule();
    }),
    OBR.scene.grid.onChange(() => schedule()),
    OBR.scene.onReadyChange(async (ok) => {
      sceneReady = ok;
      if (!ok) return;
      readTokens(await OBR.scene.items.getItems().catch(() => []));
      follow();
      schedule();
    }),
    OBR.party.onChange(async () => {
      const was = keeper;
      keeper = await isKeeper().catch(() => false);
      if (keeper && !was) void clearOldRolls().catch(() => {});
      void watchCreatures();
      schedule();
    }),
    onCampaign((next) => {
      if (next === campaign) return;
      campaign = next;
      follow();
      void watchCreatures();
    }),
    // Signing in or out in the panel (the same storage) changes what can be read.
    (() => {
      const { data } = supabase.auth.onAuthStateChange(() => void watchCreatures());
      return () => data.subscription.unsubscribe();
    })()
  );

  return () => {
    clearTimeout(timer);
    stopFollow();
    stopRolls();
    stopCreatures();
    stops.forEach((s) => s());
  };
}
