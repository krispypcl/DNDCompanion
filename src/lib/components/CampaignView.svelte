<script lang="ts">
  import { siteRoot } from '#lib/rules/share.ts';
  /**
   * A campaign's page, /c/<id>: a card for each character in it, with what a
   * DM glances at mid-fight (hit points, AC, passive Perception, conditions),
   * kept current while the page is open. Readable by anyone with the link,
   * like a sheet. Its DM also gets the invite link, a rename, removing a
   * character, ending the campaign (it is archived, and can be reopened) and
   * deleting it, a banner like a sheet's, and a jukebox of their own music.
   */
  import { onMount, tick, untrack } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { base } from '#lib/base.ts';
  import { copyText } from '#lib/clipboard.ts';
  import { cue, hearMoments } from '#lib/sound.ts';
  import { goto } from '$app/navigation';
  import { campaignMessage, campaignRepo, NO_INITIATIVE, type Campaign, type CampaignDetails, type Initiative } from '#lib/data/campaigns.ts';
  import { TableMusic } from '#lib/tableMusic.svelte.ts';
  import { sheetRepo, StaleWriteError } from '#lib/data/sheets.ts';
  import { changeHp, type HpChange } from '#lib/rules/hp.ts';
  import { isConfigured, supabase } from '#lib/supabase.ts';
  import { session } from '#lib/stores/session.ts';
  import { classLine, initiativeParts, mainClass } from '#lib/rules/derived.ts';
  import { advantageFrom } from '#lib/rules/equipment.ts';
  import { asRevealed, followRevealed, type Revealed } from '#lib/data/creatures.ts';
  import { CreatureTable } from '#lib/creatureTable.svelte.ts';
  import { initiativeMoments, next as nextTurn, previous as previousTurn, rollInitiative, settleAll, start as startTurns, unsettled, type InitiativeRow } from '#lib/rules/initiative.ts';
  import { LiveInitiative } from '#lib/initiative.svelte.ts';
  import { initiativeBonus } from '#lib/rules/statblock.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import { faceFamily, nameFont } from '#lib/rules/fonts.ts';
  import { themeStyle } from '#lib/theme.ts';
  import { rememberedTheme, rememberThemes } from '#lib/themeMemory.ts';
  import { friendlyError } from '#lib/errors.ts';
  import { fadeOver, prefersReducedMotion } from '#lib/motion.ts';
  import { smoothHeight } from '#lib/smoothHeight.ts';
  import Banner from './Banner.svelte';
  import CampaignMusic from './CampaignMusic.svelte';
  import SectionHead from './SectionHead.svelte';
  import CampaignBoard from './CampaignBoard.svelte';
  import CampaignCards from './CampaignCards.svelte';
  import D20Loader from './D20Loader.svelte';
  import ModeToggle from './ModeToggle.svelte';
  import PhoneTop from './PhoneTop.svelte';
  import { assetsReady, imagesSettled } from '#lib/assets.ts';
  import BackLink from './BackLink.svelte';
  import Crest from './Crest.svelte';
  import Lightbox from './Lightbox.svelte';
  import { hereText, webLink } from '#lib/rules/presence.ts';
  import NotFound from './NotFound.svelte';
  import CampaignSkeleton from './CampaignSkeleton.svelte';
  import CampaignCreatures from './CampaignCreatures.svelte';
  import AreaSwitch from './AreaSwitch.svelte';
  import CogIcon from './CogIcon.svelte';
  import { pageTitle } from '#lib/title.ts';
  import { sessionWhen } from '#lib/rules/dates.ts';
  import ShareButton from './ShareButton.svelte';
  import ShortcutHelp from './ShortcutHelp.svelte';
  import Spotlight from './Spotlight.svelte';
  import InitiativeTracker from './InitiativeTracker.svelte';
  import RevealedCreatures from './RevealedCreatures.svelte';
  import CampaignSettings from './CampaignSettings.svelte';
  import { musicOn, setMusicOn } from '#lib/music.ts';
  import { phone } from '#lib/stores/phone.svelte.ts';
  import PhoneBar, { type PhonePlace } from './PhoneBar.svelte';
  import { get } from 'svelte/store';
  import type { ConditionLook, Sheet } from '#lib/types.ts';

  let { id }: { id: string } = $props();

  let campaign = $state<Campaign | null>(null);
  let sheets = $state<Sheet[]>([]);
  let loading = $state(true);
  /** The die has landed: the page shows (as a sheet does). */
  let landed = $state(false);
  let missing = $state(false);
  let error = $state<string | null>(null);
  let invite = $state<string | null>(null);
  let copied = $state<'invite' | 'page' | null>(null);
  /**
   * The campaign's settings, the DM's alone, in a window of their own (the
   * gear beside Back): name, next session, invite, banner, font, theme, and
   * ending or deleting it. The page itself has no edit mode: the DM adds
   * songs and moves cards on it as it is.
   */
  let settingsOpen = $state(false);
  const unfold = () => ({ duration: prefersReducedMotion() ? 0 : 280, easing: cubicOut });

  const isDm = $derived(Boolean(campaign && $session.user && campaign.created_by === $session.user.id));
  /** In the campaign: its DM, or a player with a character in it. They may see the invite. */
  const isMember = $derived(isDm || Boolean($session.user && sheets.some((s) => s.owner_id === $session.user!.id)));
  const hasMusic = $derived(Boolean(campaign?.details.songs?.length));
  /** The table's music: the players always see the capsule; the DM chooses (remembered on the device), and it stays so in view and edit mode. */
  const musicKey = $derived(campaign ? `dndcompanion:musicCompact:${campaign.id}` : '');
  let musicChoice = $state<boolean | null>(null);
  const storedCompact = (key: string) => {
    try {
      return Boolean(key) && localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  };
  const compactMusic = $derived(!isDm || (musicChoice ?? storedCompact(musicKey)));
  function setMusicCompact(on: boolean) {
    musicChoice = on;
    try {
      if (on) localStorage.setItem(musicKey, '1');
      else localStorage.removeItem(musicKey);
    } catch {
      // Not remembered, that's all.
    }
  }

  /*
   * The DM's two sides of the table: the players' cards, and the monsters
   * and NPCs only the DM sees (CampaignCreatures, database/0017).
   */
  const SIDE_PLAYERS = 'Players';
  const SIDE_CREATURES = 'Monsters & NPCs';
  let side = $state(SIDE_PLAYERS);
  /** The DM's monsters and NPCs (lib/creatureTable), made once per campaign. */
  const dmCampaign = $derived(isDm && campaign ? campaign.id : null);
  const table = $derived(dmCampaign ? new CreatureTable(dmCampaign) : null);
  $effect(() => {
    void table?.load();
  });
  // Changes made elsewhere (another tab, the Owlbear room) land here as they happen.
  $effect(() => table?.follow());
  // What is still waiting to be saved goes before the page does.
  $effect(() => {
    const t = table;
    if (!t) return;
    const go = () => t.flushAll();
    window.addEventListener('pagehide', go);
    return () => {
      window.removeEventListener('pagehide', go);
      go();
    };
  });
  const creatureCount = $derived(table?.list.length ?? 0);
  /** What the players see of them: only the revealed ones (database/0018), live (0025). */
  let revealed = $state<Revealed[]>([]);
  /** The same, worked out from the DM's own list (lib/data/creatures asRevealed). */
  const dmRevealed = $derived(table ? asRevealed(table.list) : []);
  const revealedFor = $derived(isMember && !isDm && campaign ? campaign.id : null);
  $effect(() => {
    const id = revealedFor;
    if (!id) return;
    return followRevealed(id, (r) => (revealed = r));
  });
  /**
   * Switching sides: the new side slides in, and the room they take eases
   * from one height to the other, so what follows (the initiative order)
   * moves smoothly instead of jumping.
   */
  let sidesBox = $state<HTMLElement>();
  async function chooseSide(next: string) {
    if (next === side) return;
    const box = sidesBox;
    const from = box?.offsetHeight ?? 0;
    side = next;
    await tick();
    // A phone's place already fades in as a whole: no second motion.
    if (!box || prefersReducedMotion() || phone.current) return;
    const to = box.offsetHeight;
    if (Math.abs(to - from) < 2) return;
    box.style.overflow = 'clip';
    box.animate([{ height: `${from}px` }, { height: `${to}px` }], { duration: 280, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' })
      .finished.catch(() => {})
      .finally(() => (box.style.overflow = ''));
  }
  /** A side slides in from the side it sits on in the switch. */
  function sideIn(_node: Element, { dir = 1 }: { dir?: number } = {}) {
    return {
      duration: prefersReducedMotion() || phone.current ? 0 : 260,
      easing: cubicOut,
      css: (t: number, u: number) => `opacity: ${t}; transform: translate3d(${u * 14 * dir}px, 0, 0);`
    };
  }

  /*
   * A phone: the page in places on a bar at the bottom: the party (with the
   * music, and for the DM the switch to their monsters and NPCs), the board,
   * the search (a window, not a place), what is in sight, and the
   * initiative. The music keeps playing from whichever place you're in.
   */
  type Place = 'party' | 'board' | 'sight' | 'initiative';
  const phoneOn = $derived(phone.current);
  let place = $state<Place>('party');
  /** Moved between places at least once: from then on a place's parts fade in (app.css). */
  let moved = $state(false);
  function goPlace(next: string) {
    // Search is on the bar, but it is a window, not a place.
    if (next === 'search') return void (searching = true);
    const p = next as Place;
    if (p !== place) moved = true;
    place = p;
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  }

  /** The table's music and who is here to lead it (lib/tableMusic). */
  const music = $derived(new TableMusic(id));
  const showMusic = $derived((hasMusic || isDm) && music.ready);
  $effect(() => music.setDm(isDm));
  $effect(() => music.setUser($session.user?.id ?? null));
  $effect(() => music.start());
  const ended = $derived(Boolean(campaign?.archived));
  const bannerLink = $derived(resolveImageUrl(campaign?.details.bannerUrl));
  /** The campaign name's own font, if the DM chose one. */
  const font = $derived(nameFont(campaign?.details.nameFont));
  const face = $derived(font && font !== 'bad' ? font : null);
  /** The campaign's color, as a sheet's: picked while editing, previewed while picking. */
  let themePreview = $state<string | null>(null);
  const themeCss = $derived(themeStyle(themePreview ?? campaign?.details.theme));
  /** The colors it was last seen in (lib/themeMemory), worn while it loads: its bars and outline come in once, in its own colors. */
  const loadingTheme = $derived(themeStyle(rememberedTheme(id)));
  $effect(() => {
    const theme = campaign?.details.theme;
    if (theme) rememberThemes([[id, theme]]);
  });
  const pageLink = $derived(typeof location !== 'undefined' ? `${siteRoot(location.origin, base)}/c?id=${encodeURIComponent(id)}` : '');

  /** The keys, as on a sheet: E edits, M plays or pauses the music, ? lists them. */
  let showKeys = $state(false);
  /** The search (/ or its button): 5e.tools entries in pop-ups, and monsters for the DM to add. */
  let searching = $state(false);
  function onKey(e: KeyboardEvent) {
    if (!campaign || showKeys || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key === '?') {
      e.preventDefault();
      showKeys = true;
    } else if (e.key.toLowerCase() === 'm' && hasMusic) {
      // Heard as the speaker's own press is.
      e.preventDefault();
      const on = !get(musicOn);
      cue(on ? 'switchOn' : 'switchOff');
      setMusicOn(on);
    }
  }
  const active = $derived(sheets.filter((s) => !s.retired));
  /** Back goes to your own character at this table, or home if you have none here. */
  const retired = $derived(sheets.filter((s) => s.retired));
  let retiredOpen = $state(false);
  const inviteLink = $derived(
    invite && typeof location !== 'undefined' ? `${siteRoot(location.origin, base)}/join?code=${invite}` : ''
  );

  async function load(first = false) {
    try {
      const [c, rows] = await Promise.all([campaignRepo.get(id), sheetRepo.listCampaignSheets(id)]);
      campaign = c;
      missing = !c;
      sheets = rows;
      error = null;
    } catch (e) {
      if (first) error = friendlyError(e, 'The campaign wouldn’t load! Try again in a moment.');
    } finally {
      loading = false;
    }
  }

  /*
   * The table keeps playing while this is open. A character's sheet saving is
   * heard at once (the database announces changes to the campaign's sheets,
   * database/0007), and the page also looks again every few seconds in case
   * an announcement was missed; nothing is asked for while the tab is hidden.
   */
  /**
   * The cheap look: which sheets the campaign has and when each changed. Only
   * when that differs from what is shown are whole sheets read again (they
   * are large, and every open campaign page used to read them all every six
   * seconds).
   */
  async function lookAgain(withCampaign: boolean) {
    try {
      const stamps = await sheetRepo.campaignStamps(id);
      const shown = new Map(sheets.map((s) => [s.id, s.updated_at]));
      const moved = stamps.length !== shown.size || stamps.some((r) => shown.get(r.id) !== r.updated_at);
      if (moved) await load();
      else if (withCampaign) campaign = (await campaignRepo.get(id)) ?? campaign;
    } catch {
      // Offline for a moment: the next look tries again.
    }
  }
  /** One sheet changed: just that one is read again. */
  async function refreshOne(sheetId: string) {
    try {
      const row = await sheetRepo.loadPlain(sheetId);
      if (!row || row.campaign_id !== id) {
        sheets = sheets.filter((s) => s.id !== sheetId);
        return;
      }
      sheets = sheets.some((s) => s.id === sheetId) ? sheets.map((s) => (s.id === sheetId ? row : s)) : [...sheets, row];
    } catch {
      void load();
    }
  }

  onMount(() => {
    void load(true);
    let ticks = 0;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      ticks += 1;
      void lookAgain(ticks % 4 === 0);
    }, 15000);
    const back = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', back);
    let soon: ReturnType<typeof setTimeout> | undefined;
    const waiting = new Set<string>();
    const refreshSoon = (payload: { eventType?: string; new?: { id?: string; campaign_id?: string | null }; old?: { id?: string } }) => {
      const sid = payload?.new?.id ?? payload?.old?.id;
      // A sheet that stays in this campaign and changed: read just it.
      if (payload?.eventType === 'UPDATE' && sid && payload.new?.campaign_id === id) waiting.add(sid);
      else waiting.add('*');
      clearTimeout(soon);
      soon = setTimeout(() => {
        const ids = [...waiting];
        waiting.clear();
        if (ids.includes('*') || ids.length > 3) void load();
        else ids.forEach((x) => void refreshOne(x));
      }, 120);
    };
    const channel = isConfigured
      ? supabase
          .channel(`campaign-${id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'characters', filter: `campaign_id=eq.${id}` }, refreshSoon)
          .subscribe()
      : null;
    return () => {
      clearInterval(timer);
      clearTimeout(soon);
      document.removeEventListener('visibilitychange', back);
      if (channel) void supabase.removeChannel(channel);
    };
  });

  // The invite, for everyone in the campaign; fetched again whenever the DM makes a new one.
  const inviteRev = $derived(music.inviteRev);
  $effect(() => {
    void inviteRev;
    if (!isMember || !campaign || ended) return;
    campaignRepo.invite(campaign.id).then((c) => (invite = c)).catch(() => {});
  });

  async function copy(text: string, which: 'invite' | 'page') {
    if (!(await copyText(text))) {
      error = 'The clipboard said no! Select the link and copy it yourself.';
      return;
    }
    copied = which;
    setTimeout(() => (copied = null), 1600);
  }

  async function act(task: () => Promise<void>, fallback: string) {
    error = null;
    try {
      await task();
    } catch (e) {
      error = campaignMessage(e, fallback);
    }
  }

  const rename = (name: string) => act(async () => {
    if (!campaign || !name.trim()) return;
    await campaignRepo.rename(campaign.id, name.trim());
    campaign = { ...campaign, name: name.trim() };
  }, 'The new name wouldn’t stick! Try again.');

  const newInvite = () => act(async () => {
    if (campaign) invite = await campaignRepo.resetInvite(campaign.id);
  }, 'The old link is still the link! Try again.');

  const remove = (sheetId: string) => act(async () => {
    await campaignRepo.remove(sheetId);
    sheets = sheets.filter((s) => s.id !== sheetId);
  }, 'That character held on! Try again.');

  const setEnded = (archived: boolean) => act(async () => {
    if (!campaign) return;
    await campaignRepo.archive(campaign.id, archived);
    campaign = { ...campaign, archived };
  }, archived ? 'The story refused to end! Try again.' : 'The campaign stayed shut! Try again.');

  const destroy = () => act(async () => {
    if (!campaign) return;
    await campaignRepo.delete(campaign.id);
    await goto(`${base}/`);
  }, 'The campaign refused to vanish! Try again.');

  /** The banner and songs are saved together; the page shows the change at once. */
  /** The players with the page open (this one included); the DM is told apart. */
  const players = $derived([...music.present].filter((u) => u !== campaign?.created_by).length);
  /** Who is here, in one line with one light, as in the main menu ("DM and 3 players here"). */
  const hereLine = $derived(music.presenceKnown ? hereText(isDm || music.dmHere, players) : '');
  const crestLink = $derived(resolveImageUrl(campaign?.details.crestUrl));
  /** Its pictures (banner, crest, the characters' portraits, and every creature's, on either side of the
      DM's switch or in sight) and name font are here (lib/assets): until then the die keeps rolling. */
  let assetsDone = $state(false);
  /** The page itself, drawn but hidden under its outline until its pictures have settled. */
  let holdEl = $state<HTMLElement>();
  $effect(() => {
    if (loading || !campaign || assetsDone || !holdEl || table?.loading) return;
    const el = holdEl;
    const pics = [
      bannerLink.url, crestLink.url, ...sheets.map((s) => resolveImageUrl(s.definition?.identity?.portraitUrl).url),
      ...(table?.list ?? []).map((c) => resolveImageUrl(c.portrait).url), ...revealed.map((c) => resolveImageUrl(c.portrait ?? '').url)
    ];
    let live = true;
    void Promise.all([assetsReady(pics, [face]), imagesSettled(el)]).then(() => { if (live) assetsDone = true; });
    return () => (live = false);
  });
  const owlbear = $derived(webLink(campaign?.details.owlbearUrl));
  /** The crest full screen, grown out of the header. */
  let crestOpen = $state<Element | null>(null);
  /** When the table next meets (set by the DM). */
  const next = $derived(sessionWhen(campaign?.details.nextSession));
  /** The next session, while it is still to come. */
  const upcoming = $derived(next && !next.past ? next : null);

  async function saveDetails(patch: Partial<CampaignDetails>) {
    if (!campaign) return;
    const before = campaign.details;
    const details = { ...before, ...patch };
    campaign = { ...campaign, details };
    error = null;
    try {
      await campaignRepo.saveDetails(campaign.id, details);
    } catch (e) {
      if (campaign) campaign = { ...campaign, details: before };
      error = campaignMessage(e, 'That change slipped off the page! Try again.');
    }
  }

  /*
   * Initiative (lib/initiative, database/0019): the characters' numbers,
   * whose turn it is, and whether the DM has called for it, live for the whole
   * table; the creatures' numbers are on each creature. The DM runs it; a
   * player rolls or writes their own characters'.
   */
  const initKey = $derived(campaign?.id ?? null);
  const live = $derived(initKey ? new LiveInitiative(initKey) : null);
  $effect(() => live?.start());
  const init = $derived(live?.state ?? NO_INITIATIVE);
  const me = $derived($session.user?.id ?? null);
  // The call, each new round, one's own characters' turns, and (for the DM) the turn moving on,
  // heard as they come (not on the first look).
  let heardInit: Initiative | null = null;
  $effect(() => {
    const s = live?.state;
    if (!s || !live?.ready) {
      heardInit = null;
      return;
    }
    const mine = new Set(untrack(() => sheets).filter((x) => x.owner_id === me).map((x) => `pc:${x.id}`));
    hearMoments(initiativeMoments(heardInit, s, mine, isDm));
    heardInit = s;
  });
  const combatants = $derived<InitiativeRow[]>([
    ...active.map((s) => ({
      key: `pc:${s.id}`, name: s.definition?.identity?.name || s.name, value: init.pcs[s.id] ?? null, tie: init.ties[`pc:${s.id}`],
      dex: s.definition ? initiativeParts(s.definition).total : 0, side: 'pc' as const, mine: Boolean(me && s.owner_id === me),
      pic: resolveImageUrl(s.definition?.identity?.portraitUrl).url ?? undefined, cls: s.definition ? mainClass(s.definition) : undefined,
      themeCss: themeStyle(s.definition?.identity?.theme)
    })),
    ...(table
      ? table.list.map((c) => ({
          key: `cr:${c.id}`, name: c.name, value: c.initiative, dex: initiativeBonus(c.statblock), tie: init.ties[`cr:${c.id}`],
          side: 'creature' as const, hidden: !c.visible,
          pic: resolveImageUrl(c.portrait).url ?? undefined, kind: c.kind
        }))
      : revealed.map((c) => ({ key: `cr:${c.id}`, name: c.name, value: c.initiative, tie: init.ties[`cr:${c.id}`], side: 'creature' as const,
          pic: resolveImageUrl(c.portrait ?? '').url ?? undefined, kind: c.kind })))
  ]);
  const fighting = $derived(Boolean(init.turn));
  const myTurn = $derived(Boolean(me && init.turn && combatants.some((c) => c.key === init.turn && c.mine)));
  const mineToRoll = $derived(combatants.filter((c) => c.mine && c.value === null));
  const phonePlaces = $derived<PhonePlace[]>([
    { key: 'party', label: 'Party', icon: 'party' },
    { key: 'board', label: 'Board', icon: 'board' },
    { key: 'search', label: 'Search', icon: 'search' },
    { key: 'sight', label: 'Sight', icon: 'sight' },
    { key: 'initiative', label: 'Initiative', icon: 'hourglass', badge: place !== 'initiative' && (myTurn || (init.asking && mineToRoll.length > 0) || (isDm && fighting)) }
  ]);
  const turnNow = () => ({ turn: init.turn, round: init.round });
  const initFail = (e: unknown) => (error = campaignMessage(e, 'The order slipped! Try again.'));
  function setInitiative(key: string, value: number | null) {
    const [kind, ref] = [key.slice(0, 2), key.slice(3)];
    if (kind === 'cr') {
      const c = table?.list.find((x) => x.id === ref);
      if (c) void table!.change(c, { initiative: value });
      return;
    }
    if (!live) return;
    if (isDm) {
      const pcs = { ...init.pcs };
      if (value === null) delete pcs[ref];
      else pcs[ref] = value;
      live.patch({ pcs }).catch(initFail);
    } else {
      live.setMine(ref, value).catch(initFail);
    }
  }
  /** A d20 and what the character adds to initiative. */
  function rollOne(key: string) {
    const s = active.find((x) => `pc:${x.id}` === key);
    if (s?.definition) setInitiative(key, rollInitiative(initiativeParts(s.definition).total, undefined, advantageFrom(s.definition, 'init').length > 0));
  }
  /** Everyone still without a number: characters and creatures. */
  function rollRest() {
    if (!live) return;
    const pcs = { ...init.pcs };
    for (const s of active) if (pcs[s.id] === undefined && s.definition) pcs[s.id] = rollInitiative(initiativeParts(s.definition).total, undefined, advantageFrom(s.definition, 'init').length > 0);
    live.patch({ pcs }).catch(initFail);
    for (const c of table?.list.filter((x) => x.initiative === null) ?? []) void table!.change(c, { initiative: rollInitiative(initiativeBonus(c.statblock)) });
  }
  const moveTurn = (t: { turn: string | null; round: number }) => live?.patch({ ...t, asking: false }).catch(initFail);
  /** The fight starts: every tie as it stands is kept, so every page shows the same order. */
  const startFight = () => live?.patch({ ...startTurns(combatants), asking: false, ties: settleAll(combatants) }).catch(initFail);
  /** A tie settled by dragging. */
  const settleTie = (ties: Record<string, number>) => live?.settle(ties, isDm).catch(initFail);
  /** The DM's page numbers a fresh tie as it stands, so every page shows it the same way. */
  $effect(() => {
    if (!isDm || !live?.ready || !(init.asking || init.turn)) return;
    const fresh = unsettled(combatants);
    if (fresh) untrack(() => live.settle(fresh, true).catch(initFail));
  });
  /** A fight is coming: the players roll theirs (a fresh order). */
  const callForInitiative = () => live?.save({ ...NO_INITIATIVE, asking: true }).catch(initFail);
  /** The fight is over, or the call for it is canceled: the order is cleared for the next one. */
  function endFight() {
    live?.save(NO_INITIATIVE).catch(initFail);
    for (const c of table?.list.filter((x) => x.initiative !== null) ?? []) void table!.change(c, { initiative: null });
  }

  /**
   * The DM chooses how a condition of a player's own looks: shown at once,
   * saved a moment after the last change (a color dragged across the
   * picker is one save, not dozens).
   */
  const lookTimers = new Map<string, ReturnType<typeof setTimeout>>();
  function giveLook(sheetId: string, key: string, look: ConditionLook | null) {
    sheets = sheets.map((s) => {
      if (s.id !== sheetId) return s;
      const looks = { ...(s.definition?.conditionLooks ?? {}) };
      if (look) looks[key] = look;
      else delete looks[key];
      return { ...s, definition: { ...s.definition, conditionLooks: looks } };
    });
    const at = `${sheetId}|${key}`;
    clearTimeout(lookTimers.get(at));
    lookTimers.set(at, setTimeout(async () => {
      lookTimers.delete(at);
      try {
        await campaignRepo.setConditionLook(sheetId, key, look);
      } catch (e) {
        error = campaignMessage(e, 'That color wouldn’t stick! Try again.');
      }
    }, 350));
  }

  /**
   * A player's quick change to their own character's hit points (its card's buttons). Saved as the
   * sheet saves, one at a time per character: each starts from what was last saved, and if the sheet
   * changed meanwhile (open on another device), the same change is made again on what is there now.
   */
  const hpQueue = new Map<string, Promise<void>>();
  function changeVitals(sheetId: string, kind: HpChange, amount: number) {
    const run = async () => {
      for (let tries = 0; tries < 2; tries += 1) {
        const row = tries ? await sheetRepo.loadPlain(sheetId) : sheets.find((s) => s.id === sheetId);
        if (!row) return;
        const state = changeHp(row.state, kind, amount, Number(row.definition?.combat?.hpMax) || 0);
        try {
          const at = await sheetRepo.saveState(sheetId, state, row.updated_at);
          sheets = sheets.map((s) => (s.id === sheetId ? { ...s, state, updated_at: at } : s));
          return;
        } catch (e) {
          if (!(e instanceof StaleWriteError) || tries) throw e;
        }
      }
    };
    error = null;
    hpQueue.set(sheetId, (hpQueue.get(sheetId) ?? Promise.resolve()).then(run).catch((e) => {
      error = campaignMessage(e, 'Those hit points slipped away! Try again.');
    }));
  }

  /** The DM gives or takes away a player's conditions: shown at once, undone if refused. */
  async function giveConditions(sheetId: string, conditions: string[]) {
    const before = sheets;
    sheets = sheets.map((s) => (s.id === sheetId ? { ...s, state: { ...s.state, conditions } } : s));
    error = null;
    try {
      await campaignRepo.setConditions(sheetId, conditions);
    } catch (e) {
      sheets = before;
      error = campaignMessage(e, 'The condition slid right off! Try again.');
    }
  }
</script>

<svelte:head>
  {#if !missing && !(error && !campaign)}<title>{pageTitle(campaign?.name ?? 'Campaign')}</title>{/if}
  {#if face}<link rel="stylesheet" href={face.href} />{/if}
</svelte:head>
<!-- The header's buttons, drawn in its row on a computer and in the top bar on a phone. -->
{#snippet cog()}
  <!-- The cog turns a little on hover, and a quarter turn while its window is open. -->
  <button class="keys gear" class:open={settingsOpen} onclick={() => (settingsOpen = true)} aria-label="Campaign settings" title="Campaign settings"
          aria-haspopup="dialog" aria-expanded={settingsOpen}>
    <CogIcon />
  </button>
{/snippet}
{#snippet owl()}
  {#if owlbear && isMember}
    <!-- The table's Owlbear Rodeo room (set in Campaign settings), for the DM and the players alike. -->
    <a class="keys owlbtn" href={owlbear} target="_blank" rel="noopener noreferrer" aria-label="Open the table's Owlbear Rodeo room" title="Open the table's Owlbear Rodeo room">
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 5.5 7.5 8M19 5.5 16.5 8M6 9.5c0-2.2 2.7-3.5 6-3.5s6 1.3 6 3.5V14c0 3.3-2.7 6-6 6s-6-2.7-6-6z" />
        <circle cx="9.25" cy="11" r="1.6" /><circle cx="14.75" cy="11" r="1.6" /><path d="m11 14.2 1 1.3 1-1.3" />
      </g></svg>
    </a>
  {/if}
{/snippet}
{#snippet share()}
  <ShareButton link={pageLink} label="Copy link to this page (to watch, not join)"
               oncopied={(ok) => { if (!ok) error = 'The clipboard said no! Copy the address from the bar above instead.'; }} />
{/snippet}
{#snippet search()}
  <button class="keys searchbtn" onclick={() => (searching = true)} aria-label="Search 5e.tools" title="Search 5e.tools (/)">
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7" /><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
  </button>
{/snippet}
<!-- The invite: the figure and plus with its words on a computer, the icon alone in a phone's top bar. -->
{#snippet inviteButton(bare: boolean)}
  <button class="smallbtn invitebtn" class:done={copied === 'invite'} onclick={() => copy(inviteLink, 'invite')} disabled={!inviteLink}
          title="Copies the invite link: it lets a player's character join this campaign"
          aria-label={bare ? (copied === 'invite' ? 'Invite link copied' : 'Invite a Player') : undefined}>
    <svg viewBox="0 0 24 24" width={bare ? 17 : 15} height={bare ? 17 : 15} aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        {#if copied === 'invite'}<path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2" />{:else}
          <circle cx="9.5" cy="8.5" r="3.5" /><path d="M3 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5" /><path class="plus" d="M19 8v6M16 11h6" />
        {/if}
      </g>
    </svg>
    {#if !bare}{copied === 'invite' ? 'Link Copied!' : 'Invite a Player'}{/if}
  </button>
{/snippet}
{#snippet here()}<span class="herenote"><i class="here-dot"></i>{hereLine}</span>{/snippet}
{#snippet nextUp(n: { when: string; until: string })}<span class="nextnote">Next session {n.when}<span class="nextuntil" class:soon={n.until === 'today' || n.until === 'now'}>, {n.until === 'now' ? 'happening now' : n.until}</span></span>{/snippet}

<svelte:window onkeydown={onKey} />

{#if loading || !landed}
  <!-- The page's outline, dimmed, with the die rolling over it (as a sheet). On a phone its two
       bars are already there, so moving here from another page they hold still instead of blinking out. -->
  {#if phoneOn}
    <PhoneTop page="campaign:{id}" themeCss={loadingTheme}>
        {#snippet left()}<ModeToggle />{/snippet}
        {#snippet right()}<BackLink href="{base}/" title="Back to your characters and campaigns" />{/snippet}
    </PhoneTop>
    <PhoneBar page="campaign:{id}" places={phonePlaces} active={place} onchoose={goPlace} themeCss={loadingTheme} />
  {/if}
  <div class="loading themed" style={loadingTheme} out:fadeOver>
    <CampaignSkeleton />
    <div class="screen-center">
      <D20Loader size={56} label="Loading the campaign" result={loading || (campaign && !assetsDone) ? null : missing || (error && !campaign) ? 1 : 20}
                 onlanded={() => (landed = true)} />
    </div>
  </div>
{/if}
{#if loading}
  <!-- Nothing yet: the outline above is all there is. -->
{:else if missing}
  {#if landed}<NotFound tab="Campaign not found" title="No campaign here!" message="This campaign has wandered off the map. It may have ended, or the link is off by a letter, so check it with your DM." />{/if}
{:else if error && !campaign}
  {#if landed}<NotFound tab="Campaign didn’t load" title="That’s a critical fail!" message={error} />{/if}
{:else if campaign}
  <!-- Drawn as soon as it has loaded, but hidden under the outline (and out of reach) until its
       pictures have settled, so it appears whole; it fades in as the outline goes. -->
  <div class="holder" class:holding={!landed} inert={!landed} bind:this={holdEl}>
  <main class="themed campaignpage" class:withbanner={Boolean(bannerLink.url)} style={themeCss} data-place={phoneOn ? place : undefined} data-moved={phoneOn && moved ? '' : undefined}>
    {#if bannerLink.url}<Banner url={bannerLink.url} />{/if}
    {#if phoneOn}
      <!-- A phone's top bar, as every page's: Owlbear, the cog, and the mode at the left, and the
           link, the invite, and Back at the right. -->
      <PhoneTop page="campaign:{id}" {themeCss}>
        {#snippet left()}{@render owl()}{#if isMember}{@render cog()}{/if}<ModeToggle />{/snippet}
        {#snippet right()}{@render share()}{#if isMember && !ended}{@render inviteButton(true)}{/if}<BackLink href="{base}/" title="Back to your characters and campaigns" />{/snippet}
      </PhoneTop>
    {/if}
    <header>
      <!-- The campaign's crest, turning toward the pointer as a sheet's portrait does; with none
           set, the d20 a character with no portrait shows. -->
      <Crest src={crestLink.url ?? ''} size={phoneOn ? 4.75 : 3.25} name={campaign.name} onopen={(from) => (crestOpen = from)} />
      <div class="title">
        <!-- The next session and who is here follow in the line above the name; on a phone they
             go under it instead, as a sheet's class line, so neither line runs long. -->
        {#if ended || isDm || (!phoneOn && (upcoming || hereLine))}
          <span class="eyebrow">{#if ended}<span class="seg">Ended</span>{/if}{#if isDm}<span class="seg">You’re the DM</span>{/if}{#if !phoneOn}{#if upcoming}<span class="seg">{@render nextUp(upcoming)}</span>{/if}{#if hereLine}<span class="seg">{@render here()}</span>{/if}{/if}</span>
        {/if}
        <h1 style:font-family={faceFamily(face)}>
          {campaign.name}
        </h1>
        {#if phoneOn && (hereLine || upcoming)}
          <p class="phonesub">{#if upcoming}{@render nextUp(upcoming)}{/if}{#if hereLine}{@render here()}{/if}</p>
        {/if}
      </div>
      {#if !phoneOn}
        <div class="tools">
          <BackLink href="{base}/" title="Back to your characters and campaigns" />
          {#if isMember}{@render cog()}{/if}
          {@render owl()}
          {@render share()}
          {@render search()}
          <button class="keys kbd" onclick={() => (showKeys = true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
              <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2.5" y="6" width="19" height="12" rx="2" />
                <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" />
              </g>
            </svg>
          </button>
          <ModeToggle />
        </div>
      {/if}
    </header>

    <!-- The table's music in the very middle, as a capsule (all the players see of it); the DM's switch between
         the players and their monsters and NPCs at the right. The DM's whole jukebox takes its own row below. -->
    {#if isDm || showMusic}
      <!-- Its height eases when the jukebox folds into the capsule or opens out of it. -->
      <div class="tablewrap smooth-height" use:smoothHeight transition:slide={unfold()}>
      <div class="tablebar">
        <!-- One jukebox, capsule or whole: switching between them never stops the song. -->
        {#if showMusic}
          <div class="musicslot" class:whole={!compactMusic} class:lead={isDm} class:offstage={phoneOn && place !== 'party'}>
            <CampaignMusic campaignId={campaign.id} songs={campaign.details.songs ?? []} editing={isDm && !ended}
                           lead={isDm} playback={music.table} away={music.away} onplayback={(p) => music.send(p)}
                           onchange={(songs) => saveDetails({ songs })} compact={compactMusic}
                           oncompact={isDm ? () => setMusicCompact(true) : undefined}
                           onexpand={isDm ? () => setMusicCompact(false) : undefined} />
          </div>
        {/if}
        {#if isDm}
          <div class="sideswitch" data-places="party">
            <AreaSwitch active={side} onchoose={(k) => void chooseSide(k)} sides={[
              { key: SIDE_PLAYERS, icon: 'person', count: active.length },
              { key: SIDE_CREATURES, icon: 'monster', count: creatureCount }
            ]} />
          </div>
        {/if}
      </div>
      </div>
    {/if}

    {#if ended}
      <p class="ended" data-places="party">This campaign has ended. Its characters stay here as the story left them{#if isDm}, and nobody new can join{/if}.</p>
    {/if}

    {#if error}<p class="app-alert bad" role="alert">{error}</p>{/if}

    <!-- Every section the same way, as the table board: its title above (SectionHead), its content below.
         The players' cards, or (the DM's other side) the monsters and NPCs. The creatures stay mounted
         once opened, so their count and what was typed survive a switch back and forth. Switching
         sides eases the height between them, so the initiative order below moves smoothly. -->
    <div class="sides" bind:this={sidesBox} data-places="party">
    {#if side === SIDE_PLAYERS}
      <div class="sidepane" in:sideIn={{ dir: -1 }}>
        <section class="campsec" aria-label="Characters">
          <SectionHead title="Characters">
            {#snippet info()}
              {#if isDm}
                The party, live from their sheets. Drag a card to put them in order; + gives a condition, and its dot
                chooses the color of one of your own. A green light means that player has the page open.
              {:else}
                The party, live from their sheets. A green light means that player has the page open.
              {/if}
            {/snippet}
            {#snippet end()}
              {#if isMember && !ended && !phoneOn}{@render inviteButton(false)}{/if}
            {/snippet}
          </SectionHead>
          {#if active.length === 0}
            <p class="empty">No characters yet.{#if isDm}{' '}Send your players the invite link.{/if}</p>
          {:else}
            <CampaignCards here={music.present} sheets={active} order={campaign.details.order ?? []} {isDm} {ended}
                           onorder={(order) => saveDetails({ order })} onremove={remove} onconditions={giveConditions} onlook={giveLook}
                           {me} onvitals={changeVitals} />
          {/if}
        </section>
      </div>
    {/if}
    {#if isDm && table}
      <div class="sidepane creaturespane" hidden={side !== SIDE_CREATURES}>
        <section class="campsec" aria-label="Monsters and NPCs">
          <CampaignCreatures {table} {ended} />
        </section>
      </div>
    {/if}
    </div>

    <!-- The initiative order, after either side and the same on both, so it stays put while the
         sides switch above it. The players see it while the DM calls for initiative or a fight runs. -->
    {#if !ended && combatants.length && (isDm || fighting || init.asking)}
      <div class="campsec" transition:slide={unfold()} data-places="initiative">
        <InitiativeTracker {combatants} turn={init.turn} round={init.round} asking={init.asking} {isDm}
                           onvalue={setInitiative} onrollone={rollOne} onask={callForInitiative} oncancel={isDm ? endFight : undefined}
                           onrollrest={isDm ? rollRest : undefined}
                           onstart={startFight} onnext={() => moveTurn(nextTurn(combatants, turnNow()))} onsettle={settleTie} docked={phoneOn}
                           onprevious={() => moveTurn(previousTurn(combatants, turnNow()))} onend={endFight} />
      </div>
    {/if}

    <!-- The DM sees In sight too: what the table sees of the revealed ones. -->
    {#if isDm ? dmRevealed.length : revealed.length}
      <section class="campsec" data-places="sight" transition:slide={unfold()}><RevealedCreatures list={isDm ? dmRevealed : revealed} dm={isDm} /></section>
    {/if}

    {#if retired.length}
      <section class="campsec retired" aria-label="Retired characters" data-places="party">
        <SectionHead title="Retired ({retired.length})" folded={!retiredOpen} ontoggle={() => (retiredOpen = !retiredOpen)} controls="retired-list">
          {#snippet info()}Characters their players retired from the campaign. Their sheets stay as the story left them.{/snippet}
        </SectionHead>
        {#if retiredOpen}
          <ul id="retired-list" transition:slide={unfold()}>
            {#each retired as s (s.id)}
              <li><a class="smallbtn" href="{base}/s/{s.id}?from={id}">{s.definition?.identity?.name || s.name}</a>
                <span class="sub">{classLine(s.definition)}</span></li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    <div class="boardslot" data-places="board">
      <CampaignBoard campaignId={campaign.id} userId={$session.user?.id ?? null} canEdit={isMember && !ended} foldable={!phoneOn} />
    </div>

    {#if phoneOn && place === 'initiative' && !(!ended && combatants.length && (isDm || fighting || init.asking))}
      <p class="phoneempty" in:fade={{ duration: 200 }}>No fight right now. {isDm ? 'Call for Initiative here once the party is in.' : 'When your DM calls for initiative, you roll yours here.'}</p>
    {/if}
    {#if phoneOn && place === 'sight' && !(isDm ? dmRevealed.length : revealed.length)}
      <p class="phoneempty" in:fade={{ duration: 200 }}>{isDm ? 'Nothing in sight yet. Reveal a monster or NPC with its eye and the table sees it here.' : 'Nothing in sight yet. Monsters and NPCs your DM reveals show up here.'}</p>
    {/if}
    {#if phoneOn}
      <PhoneBar page="campaign:{id}" places={phonePlaces} active={place} onchoose={goPlace} {themeCss}>
        {#snippet dock()}
          {#if place === 'initiative' && !ended}
            {#if isDm && fighting}
              <button class="smallbtn" style="flex: 0 0 auto; padding-inline: 1.125rem" onclick={() => moveTurn(previousTurn(combatants, turnNow()))} aria-label="Previous turn">Back</button>
              <button class="smallbtn accent" onclick={() => moveTurn(nextTurn(combatants, turnNow()))}>Next Turn</button>
            {:else if isDm && init.asking}
              <button class="smallbtn accent" onclick={startFight} disabled={!combatants.some((c) => c.value !== null)}>Start the Fight</button>
            {:else if isDm && combatants.length}
              <button class="smallbtn accent" onclick={callForInitiative}><svg class="dockdie" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2.5 20.5 7.4v9.2L12 21.5 3.5 16.6V7.4zM12 7.5l4.3 7.4H7.7zM12 2.5v5M20.5 7.4l-4.2 7.5M3.5 7.4l4.2 7.5M7.7 14.9 3.5 16.6M16.3 14.9l4.2 1.7M7.7 14.9 12 21.5l4.3-6.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>Call for Initiative</button>
            {:else if !isDm && init.asking && mineToRoll.length}
              <button class="smallbtn accent" onclick={() => rollOne(mineToRoll[0].key)}><svg class="dockdie" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2.5 20.5 7.4v9.2L12 21.5 3.5 16.6V7.4zM12 7.5l4.3 7.4H7.7zM12 2.5v5M20.5 7.4l-4.2 7.5M3.5 7.4l4.2 7.5M7.7 14.9 3.5 16.6M16.3 14.9l4.2 1.7M7.7 14.9 12 21.5l4.3-6.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" /></svg>Roll initiative{mineToRoll.length > 1 ? ` for ${mineToRoll[0].name}` : ''}</button>
            {/if}
          {/if}
        {/snippet}
      </PhoneBar>
    {/if}

    {#if crestOpen && crestLink.url}
      <Lightbox src={crestLink.url} alt="{campaign.name}’s crest" from={crestOpen} onclose={() => (crestOpen = null)} />
    {/if}
    {#if settingsOpen && isMember}
      <CampaignSettings {campaign} {inviteLink} dm={isDm} onrename={rename} onsave={saveDetails} onnewinvite={newInvite}
                        onended={setEnded} ondelete={destroy} onpreview={(hex) => (themePreview = hex)}
                        onclose={() => (settingsOpen = false)} />
    {/if}
    {#if showKeys}<ShortcutHelp owner={isDm} place="campaign" onclose={() => (showKeys = false)} />{/if}
    <Spotlight bind:open={searching} homebrew={table && !ended ? table.homebrew : []}
               onadd={table && !ended ? (hit) => { void chooseSide(SIDE_CREATURES); void table.addFromFive(hit.name, hit.source); } : undefined}
               onaddhomebrew={table && !ended ? (hid) => { void chooseSide(SIDE_CREATURES); void table.addHomebrew(hid); } : undefined} />
  </main>
  </div>
{/if}

<style>
  /* As wide as a sheet (app.css --page-width); its own padding on a phone. */
  main { max-width: var(--page-width); margin: 0 auto; padding: 2rem var(--page-pad) 4rem; }
  @media (max-width: 600px) { main { padding-left: 1rem; padding-right: 1rem; } }
  /* A phone: a little room under the top bar (the layout keeps the bar's own height free). */
  @media (max-width: 700px) { main { padding-top: 1rem; padding-left: 1rem; padding-right: 1rem; } }
  /* Above the banner, which lies behind the top of the page. */
  main > :global(*) { position: relative; z-index: 1; }
  .loading { position: relative; min-height: 60vh; }
  /* The page while its pictures settle: laid out and loading, under the outline, unseen. */
  .holder.holding { position: absolute; top: 0; left: 0; right: 0; visibility: hidden; pointer-events: none; }
  /* Shown: it fades in where it stands, as the outline goes. */
  .holder:not(.holding) > main { animation: campIn 0.2s cubic-bezier(0.33, 1, 0.68, 1) backwards; }
  @keyframes campIn { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .holder:not(.holding) > main { animation: none; } }
  .loading > :global(.cskel) { opacity: 0.45; }
  header { display: flex; align-items: center; gap: 0.875rem; }
  .gear :global(svg), .owlbtn svg { transition: transform 0.45s cubic-bezier(0.33, 1, 0.68, 1); }
  .gear:hover :global(svg) { transform: rotate(45deg); }
  .gear.open :global(svg) { transform: rotate(90deg); }
  .owlbtn { text-decoration: none; }
  .owlbtn:hover svg { transform: translateY(-1px) rotate(-6deg); }
  @media (prefers-reduced-motion: reduce) { .gear :global(svg), .owlbtn svg { transition: none; } }
  .title { flex: 1; min-width: 0; }
  /* The eyebrow's parts, a dot between each two. */
  .seg + .seg::before { content: '·'; margin: 0 0.375rem; }
  .eyebrow { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--a); }
  /* A light page over a banner: the lines beside the name sit on a solid chip, so they read on any picture. */
  :global([data-mode='light']) .campaignpage.withbanner :is(.eyebrow, .phonesub) {
    width: fit-content; padding: 0.1875rem 0.625rem; border-radius: 999px;
    border: 1px solid var(--line-soft); background: color-mix(in oklab, var(--surface) 94%, transparent);
  }
  :global([data-mode='light']) .campaignpage.withbanner .eyebrow { display: inline-block; margin-bottom: 0.25rem; }
  :global([data-mode='light']) .campaignpage.withbanner .phonesub { border-radius: var(--r-sm); }
  h1 { margin: 0.125rem 0 0; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.015em; }
  .tools { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  /* Shortcuts are for a keyboard: the button only shows where there is a mouse. */
  .keys {
    display: none; place-items: center; width: 2rem; height: 2rem; flex: none; padding: 0;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    color: var(--text); cursor: pointer; transition: border-color 0.18s ease, color 0.18s ease, transform 0.08s ease;
  }
  .keys:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .keys:active { transform: translateY(1px); }
  /* The magnifier leans in to look, the keyboard's keys lift, as the cog turns. */
  .searchbtn svg, .kbd svg { transition: transform 0.4s cubic-bezier(0.33, 1, 0.68, 1); }
  .searchbtn:hover svg { transform: rotate(-14deg) scale(1.1); }
  .kbd:hover svg { transform: translateY(-1.5px) scale(1.06); }
  @media (prefers-reduced-motion: reduce) { .searchbtn svg, .kbd svg { transition: none; } }
  @media (hover: hover) and (pointer: fine) { .keys { display: inline-grid; } }
  .keys.searchbtn, .keys.gear, .keys.owlbtn { display: inline-grid; }

  /* The music and the DM's switch, in a line under the header: three equal thirds, so the music sits in the very middle. */
  .tablewrap { margin-top: 1.25rem; }
  .tablebar {
    display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.5rem 1rem;
    font-size: 0.8125rem; color: var(--dim);
  }
  .herenote { display: inline-flex; align-items: center; gap: 0.375rem; color: oklch(74% 0.17 150); }
  :global([data-mode='light']) .herenote { color: oklch(52% 0.15 150); }
  .sideswitch { grid-column: 3; grid-row: 1; justify-self: end; }
  /* The capsule in the middle of the line; the whole jukebox on a row of its own below. */
  .musicslot { grid-column: 2; grid-row: 1; display: flex; justify-content: center; min-width: 0; }
  .musicslot.whole { grid-column: 1 / -1; grid-row: 2; display: block; margin-top: 1.25rem; color: var(--text); font-size: 0.875rem; }
  /* Folded, the capsule keeps its full width whatever the song's name, and the DM's sits at the far left. */
  @media (min-width: 701px) {
    /* A fixed width: a share of an auto-sized grid cell would shrink back to the title. */
    .musicslot:not(.whole) { width: 24rem; max-width: 100%; }
    .musicslot:not(.whole) :global(.jukebox.compact) { width: 100%; max-width: none; }
    .musicslot:not(.whole) :global(.jukebox.compact .player) { flex: 1 1 auto; }
    .musicslot:not(.whole) :global(.jukebox.compact .capsule) { display: flex; width: 100%; }
    .musicslot.lead:not(.whole) { grid-column: 1; justify-content: flex-start; }
  }
  /* A phone: the music alone, the width of the screen. */
  @media (max-width: 700px) {
    .tablebar { grid-template-columns: minmax(0, 1fr); }
    .musicslot, .musicslot.whole { grid-column: 1; grid-row: auto; }
    /* The DM's switch under the music, the width of the screen. */
    .sideswitch { grid-column: 1; grid-row: auto; justify-self: stretch; display: grid; }
    /* The capsule too, edge to edge. */
    .tablebar .musicslot > :global(*), .tablebar .musicslot :global(.jukebox.compact) { flex: 1 1 auto; width: 100%; max-width: none; }
    .tablebar .musicslot :global(.capsule), .tablebar .musicslot :global(.jukebox.compact .player) { display: flex; flex: 1 1 auto; width: 100%; max-width: none; }
  }
  .nextnote { white-space: normal; }
  /* The monsters' side slides in from the right, as the players' does from the left. */
  .creaturespane:not([hidden]) { animation: creaturesIn 0.26s cubic-bezier(0.33, 1, 0.68, 1); }
  @keyframes creaturesIn { from { opacity: 0; transform: translate3d(14px, 0, 0); } }
  @media (prefers-reduced-motion: reduce) { .creaturespane:not([hidden]) { animation: none; } }
  /* How far off it is, quieter, unless it is today. */
  .nextuntil { color: var(--dim); white-space: nowrap; }
  .nextuntil.soon { color: inherit; }
  /* The invite's plus turns once on hover, a little welcome. */
  .invitebtn svg { flex: none; }
  .invitebtn .plus { transform-box: fill-box; transform-origin: center; }
  .invitebtn:hover:not(:disabled) .plus { animation: welcome 0.5s cubic-bezier(0.33, 1, 0.68, 1); }
  .invitebtn.done { color: var(--a); border-color: var(--a-edge); background: var(--a-wash); }
  @keyframes welcome { from { transform: rotate(-90deg) scale(0.6); } }
  @media (prefers-reduced-motion: reduce) { .invitebtn .plus { animation: none !important; } }
  .ended {
    margin: 1.5rem 0 0; padding: 0.75rem 1rem; border: 1px solid var(--line-soft); border-radius: var(--r);
    background: var(--surface); color: var(--dim); font-size: 0.875rem; line-height: 1.45;
  }
  /* ── A phone's places (the rules for showing one are in app.css) ── */
  main[data-place] .creaturespane:not([hidden]) { animation: none; }
  main[data-place]:not([data-place='party']) .tablewrap { margin-top: 0; }
  /* The places' own first section sits under the header as every section does. */
  main[data-place='board'] .boardslot :global(> *:first-child) { margin-top: 1.5rem; }
  .phoneempty {
    margin: 2rem 0 0; padding: 1.25rem 1rem; text-align: center; color: var(--dim); font-size: 0.9375rem; line-height: 1.5;
    border: 1px dashed var(--line); border-radius: var(--r);
  }
  /* Every section the same distance apart, as the table board. */
  .campsec { margin-top: 2rem; }
  .empty { color: var(--dim); margin: 0; }

  .retired ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.375rem; }
  .retired .smallbtn { margin-right: 0.5rem; }
  /*
   * A phone, as a sheet's header: the eyebrow across the top; the crest at the
   * left edge, and the name with the next session and who is here under it at
   * the right edge. The buttons are in the top bar.
   */
  @media (max-width: 700px) {
    h1 { font-size: 1.375rem; overflow-wrap: anywhere; }
    /* The crest at the left edge and the name with its line at the right (their words still left-aligned), room between. */
    header { display: grid; grid-template-columns: auto minmax(0, max-content); justify-content: space-between; column-gap: 1.25rem; row-gap: 0; align-items: center; }
    header .title { display: contents; }
    header > :global(.crest) { grid-column: 1; grid-row: 2 / 4; align-self: center; }
    .eyebrow { grid-column: 1 / -1; grid-row: 1; justify-self: center; text-align: center; margin-bottom: 0.875rem; letter-spacing: 0.1em; }
    header h1 { grid-column: 2; grid-row: 2; align-self: end; margin: 0; }
    .phonesub { grid-column: 2; grid-row: 3; align-self: start; }
  }
  /* Under the name: who is here and the next session, each kept whole as a sheet's class line. */
  .phonesub { margin: 0.3125rem 0 0; display: flex; flex-wrap: wrap; gap: 0.125rem 0.75rem; font-size: 0.8125rem; line-height: 1.4; color: var(--text); }
</style>
