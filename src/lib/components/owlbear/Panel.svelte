<script lang="ts">
  /**
   * The extension's panel in Owlbear Rodeo (its toolbar button): the room's
   * campaign and its characters, live from their sheets (hit points, AC,
   * conditions), each with its sheet a press away and a token to put on the
   * map wearing its portrait. A room has one campaign, pasted by its link and
   * swapped from the header; the GM puts the characters in order by picking
   * them up.
   *
   * Signed in as the campaign's DM, the panel also runs the fight: the
   * initiative order (lib/initiative) and, below the characters, the DM's
   * monsters and NPCs, each with its stat block (a popover beside the map)
   * and its tokens. Players see the order while it runs and the creatures
   * the DM has revealed. Everything follows changes as they land, wherever
   * they are made. Signing in works with an email, Google, or Discord
   * (lib/owlbear/signin).
   */
  import { onMount, untrack } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { armorClass, classLine, initiativeParts, mainClass } from '#lib/rules/derived.ts';
  import { vitalStatus } from '#lib/rules/hp.ts';
  import { lookOf } from '#lib/rules/conditions.ts';
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  import { faceFamily, fontFace } from '#lib/rules/fonts.ts';
  import { applyMode } from '#lib/stores/mode.ts';
  import { themeStyle } from '#lib/theme.ts';
  import { session } from '#lib/stores/session.ts';
  import { profile } from '#lib/stores/profile.ts';
  import { enabledProviders, PROVIDER_NAMES, profileOf, signIn, signOut, type OAuthProvider } from '#lib/data/session.ts';
  import { signInFromOwlbear } from '#lib/owlbear/signin.ts';
  import { asRevealed, followRevealed, type Revealed } from '#lib/data/creatures.ts';
  import { CreatureTable } from '#lib/creatureTable.svelte.ts';
  import { LiveInitiative } from '#lib/initiative.svelte.ts';
  import { advantageFrom } from '#lib/rules/equipment.ts';
  import { hpNow } from '#lib/rules/creatures.ts';
  import { initiativeBonus, kindLine } from '#lib/rules/statblock.ts';
  import { next as nextTurn, previous as previousTurn, rollInitiative, settleAll, start as startTurns, unsettled, type InitiativeRow } from '#lib/rules/initiative.ts';
  import { campaignRepo, inviteCode, NO_INITIATIVE, type Campaign } from '#lib/data/campaigns.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import { orderSheets, parseLink } from '#lib/owlbear/links.ts';
  import { reorder } from '#lib/reorder.ts';
  import { smoothHeight } from '#lib/smoothHeight.ts';
  import { followSheets } from '#lib/owlbear/live.ts';
  import type { ConditionLook, Sheet } from '#lib/types.ts';
  import ClassIcon from '../ClassIcon.svelte';
  import Logo from '../Logo.svelte';
  import ConditionRing from '../ConditionRing.svelte';
  import InfoTip from '../InfoTip.svelte';
  import SectionHead from '../SectionHead.svelte';
  import HpBar from './HpBar.svelte';
  import CreatureMark from '../CreatureMark.svelte';
  import RevealedCreatures from '../RevealedCreatures.svelte';
  import InitiativeTracker from '../InitiativeTracker.svelte';
  import ProviderIcon from '../ProviderIcon.svelte';

  type O = typeof import('#lib/owlbear/obr.ts');
  let obr = $state.raw<O | null>(null);
  let inOwlbear = $state(true);
  /** The room's campaign (its id, from the room), and the campaign itself once read. */
  let campaignId = $state<string | null>(null);
  let campaign = $state.raw<Campaign | null>(null);
  let sheets = $state.raw<Sheet[]>([]);
  let loaded = $state(false);
  /** Which sheets have a token on the map: sheet id → token ids. */
  let onMap = $state.raw<Record<string, string[]>>({});
  /** The same for the DM's monsters and NPCs: creature id → token ids. */
  let creaturesOnMap = $state.raw<Record<string, string[]>>({});
  /** The order the GM put the characters in, for this room. */
  let roomOrder = $state.raw<string[]>([]);
  let error = $state<string | null>(null);
  let busy = $state<string | null>(null);
  let role = $state<'GM' | 'PLAYER'>('PLAYER');

  const still = prefersReducedMotion();
  const appear = (delay = 0) => ({ duration: still ? 0 : 200, delay: still ? 0 : delay, easing: cubicOut });
  /** The swap field rolls down out of the header and back up into it, the panel below moving with it. */
  function roll(node: Element) {
    const s = slide(node, { duration: still ? 0 : 220, easing: cubicOut });
    return { ...s, css: (t: number, u: number) => `${s.css?.(t, u) ?? ''}opacity: ${t};` };
  }

  onMount(() => {
    const stops: (() => void)[] = [];
    void (async () => {
      const m = await import('#lib/owlbear/obr.ts');
      if (!m.OBR.isAvailable) {
        inOwlbear = false;
        loaded = true;
        return;
      }
      await m.ready();
      obr = m;
      // The panel asks for its full size itself: a room that added the
      // extension under an older, smaller manifest keeps that size otherwise.
      void m.OBR.action.setWidth(460).catch(() => {});
      void m.OBR.action.setHeight(760).catch(() => {});
      stops.push(await m.followTheme(applyMode));
      role = await m.OBR.player.getRole();
      stops.push(m.OBR.player.onChange((p) => (role = p.role)));
      campaignId = await m.getCampaign();
      if (!campaignId) loaded = true;
      stops.push(m.onCampaign((id) => (campaignId = id)));
      roomOrder = await m.getOrder();
      stops.push(m.onOrder((o) => (roomOrder = o)));
      const readMap = (items: { id: string; metadata: Record<string, unknown> }[]) => {
        const next: Record<string, string[]> = {};
        const beasts: Record<string, string[]> = {};
        for (const i of items) {
          const link = m.linkOf(i as never);
          if (link) (next[link.id] ??= []).push(i.id);
          const cl = m.creatureLinkOf(i as never);
          if (cl) (beasts[cl.id] ??= []).push(i.id);
        }
        onMap = next;
        creaturesOnMap = beasts;
      };
      if (await m.OBR.scene.isReady()) readMap(await m.OBR.scene.items.getItems());
      stops.push(m.OBR.scene.items.onChange(readMap));
      stops.push(m.OBR.scene.onReadyChange(async (ok) => readMap(ok ? await m.OBR.scene.items.getItems() : [])));
    })();
    return () => stops.forEach((s) => s());
  });

  // The campaign's characters and the campaign itself, followed live.
  $effect(() => {
    const id = campaignId;
    if (!id) return void (sheets = []);
    return followSheets({ sheets: [], campaigns: [id] }, (s) => {
      sheets = s;
      loaded = true;
    }, () => {
      error = 'The characters wouldn’t load! Check your connection and try again.';
      loaded = true;
    });
  });
  $effect(() => {
    const id = campaignId;
    if (!id) return void (campaign = null);
    return campaignRepo.follow(id, (c) => {
      if (campaignId === id) campaign = c;
    });
  });

  // ── The room's campaign: brought in first, swapped from the header ──
  let draft = $state('');
  let swapping = $state(false);
  let addBusy = $state(false);
  async function bringIn() {
    let link = parseLink(draft);
    error = null;
    if (!link && /[?&]code=|^[a-z0-9]{4,12}$/i.test(draft.trim())) {
      // An invite link: the campaign it opens.
      addBusy = true;
      const found = await campaignRepo.byInvite(inviteCode(draft)).catch(() => null);
      addBusy = false;
      if (found) link = { kind: 'campaign', id: found.id };
    }
    if (link?.kind === 'sheet') return void (error = 'That’s a character’s link! Paste the campaign page’s link, or its invite link.');
    if (!link) return void (error = 'That’s not a campaign link! Paste the campaign page’s link, or its invite link.');
    if (!obr) return;
    const before = campaignId;
    campaignId = link.id;
    try {
      await obr.setCampaign(link.id);
      draft = '';
      swapping = false;
    } catch (e) {
      campaignId = before;
      error = `The room wouldn’t take that! ${e instanceof Error ? e.message : 'Try again in a moment.'}`;
    }
  }
  function toggleSwap() {
    swapping = !swapping;
    draft = '';
    error = null;
  }

  // ── Tokens ──
  async function place(key: string, put: () => Promise<unknown>) {
    busy = key;
    error = null;
    try {
      await put();
    } catch (e) {
      error = e instanceof Error ? e.message : 'The token slipped off the table! Try again.';
    } finally {
      busy = null;
    }
  }
  const find = (ids: string[] | undefined) => void obr?.findTokens(ids ?? []).catch(() => {});

  /** The campaign's characters (not retired), in the GM's order for the room. */
  const characters = $derived(orderSheets(
    sheets.filter((s) => s.campaign_id === campaignId && !s.retired),
    roomOrder,
    campaign?.id === campaignId ? (campaign?.details.order ?? []) : []
  ));
  /** While the GM drags a character, the order it would land in. */
  let preview = $state.raw<string[] | null>(null);
  const shown = $derived(preview ? preview.map((id) => characters.find((s) => s.id === id)!).filter(Boolean) : characters);
  const canArrange = $derived(role === 'GM' && characters.length > 1);
  async function arrange(ids: string[]) {
    preview = null;
    roomOrder = ids;
    await obr?.setOrder(ids).catch(() => (error = 'That order didn’t stick! Try again in a moment.'));
  }
  const faces = $derived([...new Set(sheets.map((s) => fontFace(s.definition?.identity?.nameFont)?.href).filter(Boolean) as string[])]);

  // ── The fight: the DM's creatures and the initiative order ──
  const me = $derived($session.user?.id ?? null);
  const isDm = $derived(Boolean(me && campaign && campaign.id === campaignId && campaign.created_by === me && !campaign.archived));
  const dmKey = $derived(isDm ? campaignId : null);
  const table = $derived(dmKey ? new CreatureTable(dmKey) : null);
  $effect(() => void table?.load());
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
  /** The creatures a player can see (only those the DM revealed), live. */
  let revealed = $state.raw<Revealed[]>([]);
  $effect(() => {
    const id = campaignId;
    if (!id || !me || isDm) return void (revealed = []);
    return followRevealed(id, (r) => (revealed = r));
  });
  const live = $derived(campaignId ? new LiveInitiative(campaignId) : null);
  $effect(() => live?.start());
  const init = $derived(live?.state ?? NO_INITIATIVE);
  const combatants = $derived<InitiativeRow[]>([
    ...characters.map((s) => ({
      key: `pc:${s.id}`, name: obr?.nameOf(s) ?? s.name, value: init.pcs[s.id] ?? null, tie: init.ties[`pc:${s.id}`],
      // Players roll on the campaign page (one place for the whole table); here they watch.
      dex: s.definition ? initiativeParts(s.definition).total : 0, side: 'pc' as const,
      pic: resolveImageUrl(s.definition?.identity?.portraitUrl).url ?? undefined, cls: s.definition ? mainClass(s.definition) : undefined
    })),
    ...(table
      ? table.list.map((c) => ({ key: `cr:${c.id}`, name: c.name, value: c.initiative, dex: initiativeBonus(c.statblock), tie: init.ties[`cr:${c.id}`], side: 'creature' as const, hidden: !c.visible, pic: resolveImageUrl(c.portrait).url ?? undefined, kind: c.kind }))
      : revealed.map((c) => ({ key: `cr:${c.id}`, name: c.name, value: c.initiative, tie: init.ties[`cr:${c.id}`], side: 'creature' as const, pic: resolveImageUrl(c.portrait ?? '').url ?? undefined, kind: c.kind })))
  ]);
  const showOrder = $derived(Boolean(live && combatants.length && (isDm || init.turn || init.asking)));
  const orderFail = (e: unknown) => (error = e instanceof Error ? e.message : 'The order slipped! Try again.');
  const rollFor = (s: Sheet) => rollInitiative(initiativeParts(s.definition).total, undefined, advantageFrom(s.definition, 'init').length > 0);
  function setInitiative(key: string, value: number | null) {
    const ref = key.slice(3);
    if (key.startsWith('cr:')) {
      const c = table?.list.find((x) => x.id === ref);
      if (c) void table!.change(c, { initiative: value });
    } else if (live && isDm) {
      const pcs = { ...init.pcs };
      if (value === null) delete pcs[ref];
      else pcs[ref] = value;
      live.patch({ pcs }).catch(orderFail);
    }
  }
  function rollOne(key: string) {
    const s = characters.find((x) => `pc:${x.id}` === key);
    if (s?.definition) setInitiative(key, rollFor(s));
  }
  function rollRest() {
    if (!live) return;
    const pcs = { ...init.pcs };
    for (const s of characters) if (pcs[s.id] === undefined && s.definition) pcs[s.id] = rollFor(s);
    live.patch({ pcs }).catch(orderFail);
    for (const c of table?.list.filter((x) => x.initiative === null) ?? []) void table!.change(c, { initiative: rollInitiative(initiativeBonus(c.statblock)) });
  }
  const moveTurn = (t: { turn: string | null; round: number }) => live?.patch({ ...t, asking: false }).catch(orderFail);
  /** The DM's panel numbers a fresh tie as it stands, so every page shows it the same way (as the campaign page does). */
  $effect(() => {
    if (!isDm || !live?.ready || !(init.asking || init.turn)) return;
    const fresh = unsettled(combatants);
    if (fresh) untrack(() => live.settle(fresh, true).catch(orderFail));
  });
  function endFight() {
    live?.save(NO_INITIATIVE).catch(orderFail);
    for (const c of table?.list.filter((x) => x.initiative !== null) ?? []) void table!.change(c, { initiative: null });
  }
  /** Whose turn it is, picked out on the map for the DM (its token selected). */
  let lastTurn: string | null = null;
  $effect(() => {
    const t = init.turn;
    if (!isDm || !t || t === lastTurn) return;
    lastTurn = t;
    const ids = t.startsWith('pc:') ? onMap[t.slice(3)] ?? [] : creaturesOnMap[t.slice(3)] ?? [];
    if (ids.length) void obr?.OBR.player.select(ids, true).catch(() => {});
  });
  const ringOf = (conditions: string[], looks: Record<string, ConditionLook> = {}) =>
    conditions.flatMap((c) => {
      const color = lookOf(c, looks)?.color;
      return color ? [{ key: c.toLowerCase(), color }] : [];
    });

  // ── Signing in, here inside Owlbear (it keeps its own sign-in) ──
  let signing = $state(false);
  let email = $state('');
  let password = $state('');
  let authError = $state<string | null>(null);
  let authBusy = $state(false);
  /** The services switched on in Supabase (a button only for one that works). */
  let services = $state<OAuthProvider[]>([]);
  onMount(() => {
    void enabledProviders().then((on) => (services = (['google', 'discord'] as OAuthProvider[]).filter((p) => on[p])));
  });
  let withEmail = $state(false);
  let opening = $state<OAuthProvider | null>(null);
  async function signInWith(p: OAuthProvider) {
    opening = p;
    authError = null;
    try {
      await signInFromOwlbear(p);
      signing = false;
    } catch (e) {
      authError = e instanceof Error ? e.message : `${PROVIDER_NAMES[p]} didn’t answer! Try again.`;
    } finally {
      opening = null;
    }
  }
  const myName = $derived(profileOf($session.user, $profile).displayName || $session.user?.email || 'you');
  async function doSignIn(e: SubmitEvent) {
    e.preventDefault();
    authBusy = true;
    authError = null;
    try {
      await signIn(email.trim(), password);
      signing = false;
      password = '';
    } catch (err) {
      authError = err instanceof Error ? err.message : 'That didn’t work! Check your email and password.';
    } finally {
      authBusy = false;
    }
  }

  /** The field opened by a button takes the typing straight away (the autofocus attribute is blocked in Owlbear's frames). */
  function focusIf(node: HTMLInputElement, on: boolean) {
    if (on) requestAnimationFrame(() => node.focus({ preventScroll: true }));
  }
</script>

{#snippet campaignForm(first: boolean)}
  <form class="add" onsubmit={(e) => { e.preventDefault(); void bringIn(); }}>
    <input bind:value={draft} use:focusIf={!first} aria-label="A campaign’s link" placeholder="Paste your campaign’s link"
           onkeydown={(e) => { if (e.key === 'Escape' && !first) toggleSwap(); }} />
    <button class="go" disabled={!draft.trim() || addBusy}>{addBusy ? 'Bringing it in' : first ? 'Bring in' : 'Swap'}</button>
    {#if !first}<button type="button" class="smallbtn" onclick={toggleSwap}>Cancel</button>{/if}
    <InfoTip label="Where to find the link">
      On the campaign’s page, copy its link from the top of the page, or use its invite link. Every character in it
      joins the room{#if !first}, in place of the campaign here now{/if}.
    </InfoTip>
  </form>
  {#if error}<p class="err" role="alert" transition:fade={appear()}>{error}</p>{/if}
{/snippet}

{#snippet portraitOf(pic: string, ring: { key: string; color: string }[], round: boolean, mark: 'npc' | 'monster' | null, cls: string | undefined | false)}
  <span class="portrait" class:round class:ringed={ring.length > 0}>
    {#if cls !== false}<ClassIcon {cls} />{/if}
    {#if pic}
      <img src={pic} alt="" draggable="false" loading="lazy" />
    {:else if mark}
      <span class="mark"><CreatureMark kind={mark} /></span>
    {/if}
    <ConditionRing bands={ring} {round} />
  </span>
{/snippet}

{#snippet conditionList(conds: string[], looks: Record<string, ConditionLook> = {})}
  {#if conds.length}
    <ul class="conds" aria-label="Conditions">
      {#each conds as c (c)}
        {@const look = lookOf(c, looks)}
        <li style:--cc={look?.color} class:plain={!look} transition:fade={appear()}><span class="dot"></span>{c}</li>
      {/each}
    </ul>
  {/if}
{/snippet}

{#snippet tokenButtons(key: string, ids: string[] | undefined, put: () => Promise<unknown>)}
  {#if ids?.length}
    <button class="btn" onclick={() => find(ids)} transition:fade={appear()}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
      Find token
    </button>
  {/if}
  <button class="btn" disabled={busy === key} onclick={() => place(key, put)}>
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><circle cx="12" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6" /><path d="M12 15.5V21M9 21h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
    {busy === key ? 'Placing' : ids?.length ? 'Another token' : 'Place token'}
  </button>
{/snippet}

<svelte:head>
  <title>DND Companion</title>
  {#each faces as href (href)}<link rel="stylesheet" {href} />{/each}
</svelte:head>

<main class="panel">
  <!-- The header and the swap field under it share one place in the panel, so a shut field takes no room at all. -->
  <div class="headbox">
  <header>
    <Logo size={22} />
    <span class="brandname">DND Companion</span>
    {#if campaignId}
      <div class="roomtools" in:fade={appear()}>
        <InfoTip label="About this room">
          Campaign opens {campaign?.name ?? 'its page'}, and the button beside it swaps in another campaign.{#if role === 'GM'} Drag a
          character to put them in order.{/if}{#if isDm} Signed in as the DM, you run the fight from here too: the initiative
          order, and your monsters and NPCs.{/if}
        </InfoTip>
        <a class="btn" href={obr?.campaignUrl(campaignId)} target="_blank" rel="noopener noreferrer" title={campaign?.name ? `Open ${campaign.name}` : 'Open the campaign page'}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
          Campaign
        </a>
        <button class="iconbtn" class:on={swapping} aria-pressed={swapping} aria-label="Swap the room’s campaign" title="Swap the campaign" onclick={toggleSwap}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
    {/if}
  </header>
  <!-- Swapping the campaign: a field that rolls down from the header and back up into it, the
       panel below moving with it both ways. -->
  {#if inOwlbear && campaignId && swapping}
    <div class="swapform" transition:roll>{@render campaignForm(false)}</div>
  {/if}
  </div>

  {#if !inOwlbear}
    <p class="note">This page is the DND Companion extension for Owlbear Rodeo. Add it in Owlbear (Extensions → Add custom extension) with this address:
      <code>{location.origin}{location.pathname.replace(/panel\/?$/, 'manifest.json')}</code></p>
  {:else}
    {#if !loaded}
      <ul class="chars partyskel" aria-busy="true" aria-label="Gathering the party">
        {#each [0, 1, 2] as i (i)}
          <li class="card"><div class="top"><i class="skeleton skface"></i><span class="who"><i class="skeleton skname"></i><i class="skeleton skline"></i></span></div><i class="skeleton skbar"></i></li>
        {/each}
      </ul>
    {:else if !campaignId}
      <section class="start" in:fade={appear()}>
        <h2 class="lead">Bring your campaign to the table</h2>
        <p class="note">Paste your campaign’s link and every character in it joins this room, live.</p>
        {@render campaignForm(true)}
      </section>
    {:else}
      <div class="body" in:fade={appear()}>
        {#if showOrder && live}
          <div class="order" transition:fade={appear()}>
            <InitiativeTracker {combatants} turn={init.turn} round={init.round} asking={init.asking} {isDm}
                               onvalue={setInitiative} onrollone={rollOne} onask={() => live?.save({ ...NO_INITIATIVE, asking: true }).catch(orderFail)}
                               onrollrest={isDm ? rollRest : undefined}
                               onstart={() => live?.patch({ ...startTurns(combatants), asking: false, ties: settleAll(combatants) }).catch(orderFail)}
                               onsettle={isDm ? (ties) => live?.settle(ties, true).catch(orderFail) : undefined}
                               onnext={() => moveTurn(nextTurn(combatants, { turn: init.turn, round: init.round }))}
                               onprevious={() => moveTurn(previousTurn(combatants, { turn: init.turn, round: init.round }))} onend={endFight} />
          </div>
        {/if}

        {#if error && !swapping}<p class="err" role="alert" transition:fade={appear()}>{error}</p>{/if}

        <section class="group">
          {#if isDm}
            <SectionHead title="Characters">
              {#snippet info()}The campaign’s characters, live from their sheets.{#if canArrange} Drag one to put them in order.{/if}{/snippet}
            </SectionHead>
          {/if}
          {#if !characters.length}
            <p class="note" in:fade={appear()}>No characters in this campaign yet.</p>
          {:else}
            <ul class="chars" class:can-reorder={canArrange}
                use:reorder={{ enabled: canArrange, keys: characters.map((s) => s.id), onpreview: (k) => (preview = k), oncommit: arrange, scale: 1.02 }}>
              {#each shown as s (s.id)}
                {@const def = s.definition}
                {@const max = Number(def?.combat?.hpMax) || 0}
                {@const cur = Number(s.state?.hpCurrent) || 0}
                {@const v = vitalStatus(cur, max, s.state?.deathSaves)}
                {@const conds = s.state?.conditions ?? []}
                {@const face = fontFace(def?.identity?.nameFont)}
                <li class="card themed {v.vital}" class:onturn={init.turn === `pc:${s.id}`} data-key={s.id} style={themeStyle(def?.identity?.theme)}
                    animate:flip={{ duration: still ? 0 : 280, easing: cubicOut }} transition:fade={appear()}>
                  <div class="top">
                    {@render portraitOf(resolveImageUrl(def?.identity?.portraitUrl).url, ringOf(conds, def?.conditionLooks), false, null, def ? mainClass(def) : false)}
                    <span class="who">
                      <strong style:font-family={faceFamily(face)}>{obr?.nameOf(s) ?? s.name}</strong>
                      <span class="sub">{classLine(def) || 'No class yet'}</span>
                    </span>
                    <span class="ac" title="Armor Class"><b>{def ? armorClass(def).total : '–'}</b><small>AC</small></span>
                  </div>
                  {#if max > 0}
                    <div title={v.label}><HpBar {cur} {max} temp={Number(s.state?.hpTemp) || 0} vital={v.vital} /></div>
                  {/if}
                  {@render conditionList(conds, def?.conditionLooks)}
                  <div class="acts">
                    <a class="btn" href={obr?.sheetUrl(s.id)} target="_blank" rel="noopener noreferrer">
                      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 3.5h9l3 3v14H6zM9 9h6M9 12.5h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                      Open sheet
                    </a>
                    {@render tokenButtons(s.id, onMap[s.id], () => obr!.placeToken(s))}
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

        {#if isDm && table}
          <section class="group" in:fade={appear()}>
            <SectionHead title="Monsters & NPCs">
              {#snippet info()}Yours alone, live from the campaign page, where you add them and reveal them to your players. Change their hit points from a token’s right-click menu.{/snippet}
            </SectionHead>
            {#if table.loading}
              <ul class="chars" aria-busy="true" aria-label="Gathering the monsters">
                <li class="card"><div class="top"><i class="skeleton skface round"></i><span class="who"><i class="skeleton skname"></i><i class="skeleton skline"></i></span></div><i class="skeleton skbar"></i></li>
              </ul>
            {:else if !table.list.length}
              <p class="note" in:fade={appear()}>No monsters or NPCs yet. Add them on the campaign page.</p>
            {:else}
              <ul class="chars" in:fade={appear()}>
                {#each table.list as c (c.id)}
                  {@const max = c.hp_max ?? 0}
                  {@const now = hpNow(c)}
                  {@const v = vitalStatus(now, max)}
                  {@const kind = kindLine(c.statblock ?? {})}
                  <li class="card {v.vital}" class:onturn={init.turn === `cr:${c.id}`}
                      animate:flip={{ duration: still ? 0 : 280, easing: cubicOut }} transition:fade={appear()}>
                    <div class="top">
                      {@render portraitOf(resolveImageUrl(c.portrait).url, ringOf(c.conditions, c.condition_looks), true, c.kind, false)}
                      <span class="who">
                        <strong>{c.name}</strong>
                        <span class="sub">{c.kind === 'npc' ? 'NPC' : 'Monster'}{kind ? `, ${kind}` : ''}{c.statblock?.cr ? `, CR ${c.statblock.cr}` : ''}</span>
                      </span>
                      {#if !c.visible}
                        <span class="hidden" role="img" aria-label="Hidden from your players" title="Hidden from your players" transition:fade={appear()}>
                          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                        </span>
                      {/if}
                      <span class="ac" title="Armor Class"><b>{c.ac ?? '–'}</b><small>AC</small></span>
                    </div>
                    {#if max > 0}
                      <div title={v.label}><HpBar cur={now} {max} temp={c.hp_temp} vital={v.vital} /></div>
                    {/if}
                    {@render conditionList(c.conditions, c.condition_looks)}
                    <div class="acts">
                      <button class="btn" onclick={() => obr?.openStats(c.campaign_id, c.id)}>
                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 3.5h9l3 3v14H6zM9 9h6M9 12.5h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
                        Stat block
                      </button>
                      {@render tokenButtons(c.id, creaturesOnMap[c.id], () => obr!.placeCreatureToken(c))}
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>
        {/if}

        <RevealedCreatures list={isDm && table ? asRevealed(table.list) : revealed} dm={isDm} />
      </div>
    {/if}

    <footer class="smooth-height" use:smoothHeight>
      <div class="swap-cell">
        {#if signing && !$session.user}
          <div class="signin" in:fade={appear(90)} out:fade={appear()}>
            {#if services.length && !withEmail}
              <div class="services">
                {#each services as p (p)}
                  <button class="go service {p}" disabled={opening !== null} onclick={() => signInWith(p)}>
                    <ProviderIcon provider={p} />{opening === p ? `Waiting for ${PROVIDER_NAMES[p]}` : `Continue with ${PROVIDER_NAMES[p]}`}
                  </button>
                {/each}
              </div>
              <div class="row">
                <button type="button" class="smallbtn" onclick={() => (withEmail = true)}>Use an email instead</button>
                <button type="button" class="smallbtn" onclick={() => { signing = false; authError = null; }}>Cancel</button>
                <InfoTip label="About signing in here">A small window opens for {services.map((p) => PROVIDER_NAMES[p]).join(' or ')}; once you’re in, it closes and you’re signed in here. If nothing opens, allow pop-ups for owlbear.rodeo.</InfoTip>
              </div>
            {:else}
              <form class="signin" onsubmit={doSignIn}>
                <input type="email" bind:value={email} placeholder="Email" autocomplete="email" aria-label="Email" required use:focusIf={true} />
                <input type="password" bind:value={password} placeholder="Password" autocomplete="current-password" aria-label="Password" required />
                <div class="row">
                  <button class="go" disabled={authBusy}>{authBusy ? 'Signing in' : 'Sign in'}</button>
                  {#if services.length}<button type="button" class="smallbtn" onclick={() => (withEmail = false)}>Back</button>{/if}
                  <button type="button" class="smallbtn" onclick={() => { signing = false; withEmail = false; authError = null; }}>Cancel</button>
                </div>
              </form>
            {/if}
            {#if authError}<p class="err" role="alert" transition:fade={appear()}>{authError}</p>{/if}
          </div>
        {:else}
          <div class="who-row" in:fade={appear(90)} out:fade={appear()}>
            {#if $session.user}
              <span class="me">Signed in as {myName}
                <InfoTip label="What signing in does">You can change hit points from a token’s right-click menu. As the campaign’s DM, you run the fight and see your monsters and NPCs here.</InfoTip>
              </span>
              <button class="smallbtn" onclick={() => signOut()}>Sign out</button>
            {:else}
              <span class="me">Not signed in
                <InfoTip label="Why sign in">
                  Sign in to change hit points from a token; the DM signs in to run the fight. Owlbear keeps its own sign-in, apart from the site’s.
                </InfoTip>
              </span>
              <button class="smallbtn" onclick={() => (signing = true)}>Sign in</button>
            {/if}
          </div>
        {/if}
      </div>
    </footer>
  {/if}
</main>

<style>
  :global(html.in-owlbear), :global(html.in-owlbear body) { background: var(--bg); }
  .panel { padding: 1.125rem 1.125rem 1.5rem; font-size: 0.9375rem; display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 1.125rem; }
  /* The brand on the left; the bubble, the room's campaign, and the swap on the right, on one line. */
  header { display: flex; align-items: center; gap: 0.5rem; min-height: 2rem; color: var(--text); }
  header .brandname { font-size: 1.1875rem; white-space: nowrap; }
  .roomtools { margin-left: auto; display: flex; align-items: center; gap: 0.375rem; }
  .roomtools .btn { display: inline-flex; align-items: center; gap: 0.375rem; height: 2rem; box-sizing: border-box; padding: 0 0.625rem; font-size: 0.8125rem; }
  .note { margin: 0; color: var(--dim); font-size: 0.875rem; line-height: 1.5; }
  .note code { display: block; margin-top: 0.375rem; word-break: break-all; color: var(--text); }
  .err { margin: 0; color: var(--bad); font-size: 0.8125rem; line-height: 1.4; }
  .body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
  .group { display: grid; gap: 0.75rem; }
  .group :global(.sechead) { margin-bottom: 0; }

  .add { display: flex; gap: 0.5rem; align-items: center; }
  .add input { width: 0; }
  .start {
    display: grid; gap: 0.625rem; padding: 1rem; border: 1px solid var(--a-edge); border-radius: var(--r);
    background: color-mix(in oklab, var(--a) 6%, var(--surface));
  }
  .start .lead { margin: 0; font-size: 1rem; letter-spacing: 0.01em; color: var(--text); font-weight: 600; }
  /* The swap field folds open under the header; shut, it takes no room. */
  .headbox { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0; }
  .swapform { display: grid; gap: 0.5rem; padding-top: 1.125rem; min-width: 0; }
  input {
    flex: 1; min-width: 0; font: inherit; font-size: 0.875rem; padding: 0.5rem 0.6875rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface);
    transition: border-color 0.15s ease;
  }
  input:hover { border-color: var(--a-edge); }
  input:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  button, .btn { font: inherit; cursor: pointer; }
  .go, .btn, .iconbtn {
    border: 1px solid var(--line); background: var(--raised); color: var(--text); border-radius: var(--r-sm);
    padding: 0.4375rem 0.75rem; font-size: 0.875rem; text-decoration: none; white-space: nowrap;
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }
  .iconbtn { width: 2rem; height: 2rem; padding: 0; display: grid; place-items: center; flex: none; }
  .iconbtn svg { transition: rotate 0.24s cubic-bezier(0.33, 1, 0.68, 1); }
  .iconbtn.on { border-color: var(--a-edge); color: var(--a); }
  .iconbtn.on svg { rotate: 180deg; }
  .go:hover:not(:disabled), .btn:hover:not(:disabled), .iconbtn:hover { border-color: var(--a-edge); color: var(--a); }
  .go:active:not(:disabled), .btn:active:not(:disabled), .iconbtn:active { transform: translateY(1px); }
  .go:focus-visible, .btn:focus-visible, .iconbtn:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .go:disabled, .btn:disabled { opacity: 0.5; cursor: default; }
  @media (prefers-reduced-motion: reduce) { .iconbtn svg { transition: none; } }

  .chars { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; }
  .card {
    border: 1px solid var(--line-soft); border-radius: var(--r); background: var(--surface); padding: 0.875rem 1rem;
    display: grid; gap: 0.75rem; transition: border-color 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease;
  }
  .card:hover { border-color: var(--a-edge); }
  .card.bloodied { border-color: color-mix(in oklab, var(--hurt-red) 45%, var(--line-soft)); }
  .card.critical, .card.down { border-color: color-mix(in oklab, var(--hurt-red) 80%, transparent); }
  .card.dead { opacity: 0.7; }
  /* Whose turn it is: the card glows in its own color. */
  .card.onturn { border-color: var(--a); box-shadow: 0 0 0 1px var(--a), 0 0 18px color-mix(in oklab, var(--a) 28%, transparent); }
  .top { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
  .portrait {
    position: relative; flex: none; width: 3rem; height: 3rem; border-radius: var(--r-sm);
    border: 1px solid var(--a-edge); background: linear-gradient(150deg, var(--portrait-from, var(--raised)), var(--portrait-to, var(--surface)));
    display: grid; place-items: center; transition: border-color 0.35s ease;
  }
  .portrait.round { border-radius: 50%; }
  .portrait.ringed { border-color: transparent; }
  .portrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  .portrait .mark { display: grid; color: var(--dim); }
  .who { display: grid; gap: 0.125rem; min-width: 0; flex: 1; }
  .who strong { font-size: 1rem; overflow-wrap: anywhere; }
  .sub { font-size: 0.8125rem; color: var(--dim); overflow-wrap: anywhere; }
  .hidden { flex: none; display: grid; place-items: center; color: var(--faint); }
  .ac { flex: none; display: grid; justify-items: center; line-height: 1.1; padding: 0.3125rem 0.5625rem; border: 1px solid var(--line-soft); border-radius: var(--r-sm); background: var(--raised); }
  .ac b { font-size: 1.0625rem; font-variant-numeric: tabular-nums; }
  .ac small { font-size: 0.5625rem; letter-spacing: 0.1em; color: var(--label); }

  .conds { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .conds li {
    display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; padding: 0.125rem 0.5625rem;
    border-radius: 999px; border: 1px solid color-mix(in oklab, var(--cc, var(--line)) 55%, transparent);
    background: color-mix(in oklab, var(--cc, var(--raised)) 14%, transparent);
  }
  .conds .dot { width: 0.4375rem; height: 0.4375rem; border-radius: 50%; background: var(--cc, var(--faint)); }
  .conds .plain .dot { background: none; border: 1px solid var(--faint); }
  /* The card's buttons share its width in equal parts, on one line. */
  .acts { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 0.5rem; }
  .acts .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; padding: 0.4375rem 0.5rem; font-size: 0.8125rem; }
  .acts .btn svg { flex: none; }

  footer { font-size: 0.8125rem; color: var(--dim); border-top: 1px solid var(--line-soft); padding-top: 0.875rem; box-sizing: content-box; }
  /* Who is signed in on the left (with its bubble), the button on the right. */
  .who-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .me { display: inline-flex; align-items: center; gap: 0.375rem; min-width: 0; overflow-wrap: anywhere; }
  .signin { display: grid; gap: 0.5rem; }
  .services { display: grid; gap: 0.5rem; }
  .service { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.5625rem 0.75rem; }
  .signin input { width: 100%; box-sizing: border-box; }
  .signin .row { display: flex; gap: 0.5rem; align-items: center; }
  .order :global(.initiative) { margin-top: 0; }
  .partyskel .card { min-height: 7rem; }
  .skface { width: 3rem; height: 3rem; border-radius: var(--r-sm); flex: none; }
  .skface.round { border-radius: 50%; }
  .skname { width: 8rem; height: 1rem; }
  .skline { width: 11rem; height: 0.75rem; }
  .skbar { height: 0.625rem; border-radius: 999px; }
</style>
