<script lang="ts">
  /**
   * The extension's panel in Owlbear Rodeo (its toolbar button): the room's
   * characters, live from their sheets — hit points, AC, conditions — with a
   * way to open each sheet, put its token on the map (wearing its portrait),
   * and the latest rolls made on the sheets. A room has one campaign (pasted
   * by its link, replaceable) and any characters added on their own; the DM
   * (Owlbear's GM) puts them in order by picking them up.
   */
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';
  import { fade, slide } from 'svelte/transition';
  import { cubicOut, quintOut } from 'svelte/easing';
  import { armorClass, classLine } from '$lib/rules/derived';
  import { vitalStatus } from '$lib/rules/hp';
  import { lookOf } from '$lib/rules/conditions';
  import { resolveImageUrl } from '$lib/rules/imageUrl';
  import { faceFamily, fontFace } from '$lib/rules/fonts';
  import { friendlyDate } from '$lib/rules/dates';
  import { applyMode } from '$lib/stores/mode';
  import { themeStyle } from '$lib/theme';
  import { session } from '$lib/stores/session';
  import { signIn, signOut } from '$lib/data/session';
  import { campaignRepo, inviteCode, type Campaign } from '$lib/data/campaigns';
  import { prefersReducedMotion } from '$lib/motion';
  import { addLink, campaignOf, orderSheets, parseLink, removeLink, type RoomLink, type RoomLinks } from '$lib/owlbear/links';
  import { reorder } from '$lib/reorder';
  import { smoothHeight } from '$lib/smoothHeight';
  import { followSheets } from '$lib/owlbear/live';
  import { diceLine, headline, natural, type RollNote } from '$lib/owlbear/rolls';
  import type { Sheet } from '$lib/types';
  import Logo from '../Logo.svelte';
  import ConditionRing from '../ConditionRing.svelte';
  import InfoTip from '../InfoTip.svelte';
  import HpBar from './HpBar.svelte';

  type O = typeof import('$lib/owlbear/obr');
  let obr = $state.raw<O | null>(null);
  let inOwlbear = $state(true);
  let links = $state.raw<RoomLinks>([]);
  let sheets = $state.raw<Sheet[]>([]);
  let loaded = $state(false);
  let rolls = $state.raw<RollNote[]>([]);
  /** Which sheets have a token on the map: sheet id → token ids. */
  let onMap = $state.raw<Record<string, string[]>>({});
  let campaignNames = $state(new Map<string, string>());
  /** The room's campaign (its name, songs and order), once read. */
  let campaign = $state.raw<Campaign | null>(null);
  /** The order the DM put the characters in, for this room. */
  let roomOrder = $state.raw<string[]>([]);
  let draft = $state('');
  let error = $state<string | null>(null);
  let busy = $state<string | null>(null);
  let role = $state<'GM' | 'PLAYER'>('PLAYER');

  const ease = () => ({ duration: prefersReducedMotion() ? 0 : 240, easing: cubicOut });

  onMount(() => {
    const stops: (() => void)[] = [];
    let stopFollow = () => {};
    let followKey = '';
    const follow = (l: RoomLinks) => {
      const f = { sheets: l.filter((x) => x.kind === 'sheet').map((x) => x.id), campaigns: l.filter((x) => x.kind === 'campaign').map((x) => x.id) };
      const key = JSON.stringify(f);
      if (key === followKey) return;
      followKey = key;
      stopFollow();
      stopFollow = followSheets(f, (s) => {
        sheets = s;
        loaded = true;
      }, () => {
        error = 'The characters wouldn’t load! Check your connection and try again.';
        loaded = true;
      });
    };
    void (async () => {
      const m = await import('$lib/owlbear/obr');
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
      links = await m.getLinks();
      follow(links);
      rolls = await m.getRolls();
      roomOrder = await m.getOrder();
      stops.push(m.onOrder((o) => (roomOrder = o)));
      stops.push(m.onLinks((l) => { links = l; follow(l); }));
      stops.push(m.onRolls((r) => (rolls = r)));
      const readMap = (items: { id: string; metadata: Record<string, unknown> }[]) => {
        const next: Record<string, string[]> = {};
        for (const i of items) {
          const link = m.linkOf(i as never);
          if (link) (next[link.id] ??= []).push(i.id);
        }
        onMap = next;
      };
      if (await m.OBR.scene.isReady()) readMap(await m.OBR.scene.items.getItems());
      stops.push(m.OBR.scene.items.onChange(readMap));
      stops.push(m.OBR.scene.onReadyChange(async (ok) => readMap(ok ? await m.OBR.scene.items.getItems() : [])));
    })();
    return () => {
      stopFollow();
      stops.forEach((s) => s());
    };
  });

  /**
   * Adding: up front while the room has no campaign (one field), otherwise
   * from the buttons under the rolls, which give way to the field while it
   * is in use and come back once it is done with.
   */
  let adding = $state<'character' | 'campaign' | null>(null);
  let addBusy = $state(false);
  async function add() {
    let link = parseLink(draft);
    error = null;
    if (!link && /[?&]code=|^[a-z0-9]{4,12}$/i.test(draft.trim())) {
      // An invite link: the campaign it opens.
      addBusy = true;
      const found = await campaignRepo.byInvite(inviteCode(draft)).catch(() => null);
      addBusy = false;
      if (found) link = { kind: 'campaign', id: found.id };
    }
    if (!link) {
      error = adding === 'character'
        ? 'That’s not a character’s link! Open their sheet in DND Companion and copy its link.'
        : 'That’s not a campaign link! Paste the campaign page’s link, or its invite link.';
      return;
    }
    draft = '';
    adding = null;
    await addToRoom(link);
  }
  function startAdding(kind: 'character' | 'campaign') {
    draft = '';
    error = null;
    adding = kind;
  }
  function stopAdding() {
    draft = '';
    error = null;
    adding = null;
  }
  async function addToRoom(link: RoomLink) {
    if (!obr) return;
    const before = links;
    const next = addLink(links, link);
    links = next;
    try {
      await obr.setLinks(next);
    } catch (e) {
      links = before;
      error = `The room wouldn’t take that! ${e instanceof Error ? e.message : 'Try again in a moment.'}`;
    }
  }
  async function unlink(link: RoomLink) {
    if (!obr) return;
    const next = removeLink(links, link);
    links = next;
    await obr.setLinks(next).catch(() => (error = 'That one held on! Try again in a moment.'));
  }
  async function place(s: Sheet) {
    if (!obr) return;
    busy = s.id;
    error = null;
    try {
      await obr.placeToken(s);
    } catch (e) {
      error = e instanceof Error ? e.message : 'The token slipped off the table! Try again.';
    } finally {
      busy = null;
    }
  }
  async function find(s: Sheet) {
    if (!obr) return;
    const ids = onMap[s.id] ?? [];
    if (!ids.length) return;
    await obr.OBR.player.select(ids, true);
    const box = await obr.OBR.scene.items.getItemBounds(ids).catch(() => null);
    if (box) await obr.OBR.viewport.animateToBounds({ ...box, min: { x: box.min.x - box.width, y: box.min.y - box.height }, max: { x: box.max.x + box.width, y: box.max.y + box.height }, width: box.width * 3, height: box.height * 3 });
  }

  const campaignId = $derived(campaignOf(links));
  /** The room's characters, in the DM's order: the campaign's (not retired) and any added on their own. */
  const direct = $derived(new Set(links.filter((l) => l.kind === 'sheet').map((l) => l.id)));
  const characters = $derived(
    orderSheets(
      sheets.filter((s) => direct.has(s.id) || (s.campaign_id === campaignId && !s.retired)),
      roomOrder,
      campaign?.id === campaignId ? (campaign?.details.order ?? []) : []
    )
  );
  /** While the DM drags a character, the order it would land in. */
  let preview = $state.raw<string[] | null>(null);
  const shown = $derived(preview ? preview.map((id) => characters.find((s) => s.id === id)!).filter(Boolean) : characters);
  const canArrange = $derived(role === 'GM' && characters.length > 1);
  async function arrange(ids: string[]) {
    roomOrder = ids;
    await obr?.setOrder(ids).catch(() => (error = 'That order didn’t stick! Try again in a moment.'));
  }

  // The room's campaign, read again whenever it changes.
  $effect(() => {
    const id = campaignId;
    if (!id) return void (campaign = null);
    if (campaign?.id === id) return;
    campaignRepo.get(id).then((c) => { if (campaignId === id) campaign = c; }).catch(() => {});
  });
  const askedNames = new Set<string>();
  /** The names of the campaigns characters added on their own are in. */
  $effect(() => {
    const ids = [...new Set(sheets.map((s) => s.campaign_id ?? '').filter(Boolean))];
    const missing = ids.filter((id) => !askedNames.has(id));
    if (!missing.length) return;
    missing.forEach((id) => askedNames.add(id));
    campaignRepo
      .byIds(missing)
      .then((list) => (campaignNames = new Map([...campaignNames, ...list.map((c) => [c.id, c.name] as const)])))
      .catch(() => {});
  });
  const directLink = (s: Sheet) => links.find((l) => l.kind === 'sheet' && l.id === s.id) ?? null;
  const faces = $derived([...new Set(sheets.map((s) => fontFace(s.definition?.identity?.nameFont)?.href).filter(Boolean) as string[])]);

  // ── Signing in, here inside Owlbear (it keeps its own sign-in) ──
  let signing = $state(false);
  let email = $state('');
  let password = $state('');
  let authError = $state<string | null>(null);
  let authBusy = $state(false);
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

  const ago = (at: number, _tick = 0) => {
    const s = Math.round((Date.now() - at) / 1000);
    if (s < 50) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    return friendlyDate(new Date(at).toISOString());
  };
  let tickNow = $state(0);
  onMount(() => {
    const t = setInterval(() => (tickNow += 1), 30000);
    return () => clearInterval(t);
  });
</script>

{#snippet addForm(kind: 'character' | 'campaign', first: boolean)}
  <form class="add" onsubmit={(e) => { e.preventDefault(); void add(); }}>
    <input bind:value={draft} use:focusIf={!first} aria-label={kind === 'character' ? 'A character’s link' : 'A campaign’s link'}
           placeholder={kind === 'character' ? 'Paste a character’s link' : 'Paste your campaign’s link'} />
    <button class="go" disabled={!draft.trim() || addBusy}>{addBusy ? 'Adding…' : 'Add'}</button>
    {#if !first}<button type="button" class="smallbtn" onclick={stopAdding}>Cancel</button>{/if}
    <InfoTip label="Where to find the link">
      {#if kind === 'character'}
        Open the character’s sheet in DND Companion and copy its link from the top of the sheet.
      {:else}
        On the campaign’s page, copy its link from the top of the page, or use its invite link. Every character in it
        joins the room{#if !first}, in place of the campaign here now{/if}.
      {/if}
    </InfoTip>
  </form>
  {#if error}<p class="err" role="alert">{error}</p>{/if}
{/snippet}

<svelte:head>
  <title>DND Companion</title>
  {#each faces as href (href)}<link rel="stylesheet" {href} />{/each}
</svelte:head>

<main class="panel">
  <header>
    <Logo size={22} />
    <span class="brandname">DND Companion</span>
  </header>

  {#if !inOwlbear}
    <p class="note">This page is the DND Companion extension for Owlbear Rodeo. Add it in Owlbear (Extensions → Add custom extension) with this address:
      <code>{location.origin}{location.pathname.replace(/panel\/?$/, 'manifest.json')}</code></p>
  {:else}
    {#if !loaded}
      <p class="note">Gathering the party…</p>
    {:else if !campaignId}
      <section class="start" in:fade={{ duration: 180 }}>
        <h2 class="lead">Bring your campaign to the table</h2>
        <p class="note">Paste your campaign’s link and every character in it joins this room, live.</p>
        {@render addForm('campaign', true)}
      </section>
    {/if}

    {#if campaignId}
      <div class="acts room" in:fade={{ duration: 180 }}>
        <a class="btn" href={obr?.campaignUrl(campaignId)} target="_blank" rel="noopener noreferrer" title={campaign?.name ? `Open ${campaign.name}` : 'Open the campaign page'}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
          Campaign
        </a>
        <button class="btn" onclick={() => obr?.openBoard(campaignId!)}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 5h16v11H4zM8 20h8M12 16v4M7.5 12.5l3-3 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
          Board
        </button>
        {#if campaign?.details.songs?.length}
          <button class="btn" onclick={() => obr?.openMusic(campaignId!)} in:fade={{ duration: 160 }}>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
            Music
          </button>
        {/if}
        <InfoTip label="About these buttons">
          Campaign opens its page. Board opens its board over the room. Music plays the DM’s table music in a small
          player that stays open.{#if role === 'GM'} Drag a character to put them in order.{/if}
        </InfoTip>
      </div>
    {/if}

    {#if loaded && campaignId && !characters.length}<p class="note">No characters in this campaign yet.</p>{/if}
    {#if characters.length}
      <ul class="chars cascade" class:can-reorder={canArrange}
          use:reorder={{ enabled: canArrange, keys: characters.map((s) => s.id), onpreview: (k) => (preview = k), oncommit: arrange, scale: 1.02 }}>
        {#each shown as s, i (s.id)}
          {@const def = s.definition}
          {@const max = Number(def?.combat?.hpMax) || 0}
          {@const cur = Number(s.state?.hpCurrent) || 0}
          {@const temp = Number(s.state?.hpTemp) || 0}
          {@const v = vitalStatus(cur, max, s.state?.deathSaves)}
          {@const portrait = resolveImageUrl(def?.identity?.portraitUrl).url}
          {@const conds = s.state?.conditions ?? []}
          {@const ring = conds.flatMap((c) => { const color = lookOf(c, def?.conditionLooks ?? {})?.color; return color ? [{ key: c.toLowerCase(), color }] : []; })}
          {@const face = fontFace(def?.identity?.nameFont)}
          <li class="char themed {v.vital}" data-key={s.id} style={themeStyle(def?.identity?.theme)} style:--i={i} animate:flip={{ duration: 280, easing: quintOut }}>
            <div class="top">
              <span class="portrait" class:ringed={ring.length > 0}>
                {#if portrait}<img src={portrait} alt="" draggable="false" />{/if}
                <ConditionRing bands={ring} />
              </span>
              <span class="who">
                <strong style:font-family={faceFamily(face)}>{obr?.nameOf(s) ?? s.name}</strong>
                <span class="sub">{classLine(def) || 'No class yet'}</span>
              </span>
              <span class="ac" title="Armour Class"><b>{def ? armorClass(def).total : '—'}</b><small>AC</small></span>
              {#if directLink(s)}
                <button class="x" title="Take out of the room" aria-label="Take {obr?.nameOf(s)} out of the room" onclick={() => unlink(directLink(s)!)}>×</button>
              {/if}
            </div>
            {#if max > 0}
              <div title={v.label}><HpBar {cur} {max} {temp} vital={v.vital} /></div>
            {/if}
            {#if conds.length}
              <ul class="conds" aria-label="Conditions">
                {#each conds as c (c)}
                  {@const look = lookOf(c, def?.conditionLooks ?? {})}
                  <li style:--cc={look?.color} class:plain={!look} transition:fade={{ duration: 160 }}><span class="dot"></span>{c}</li>
                {/each}
              </ul>
            {/if}
            {#if s.campaign_id && s.campaign_id !== campaignId}
              <!-- Added on its own, it may be in a campaign of its own. -->
              <p class="camp">In <b>{campaignNames.get(s.campaign_id) ?? 'a campaign'}</b>
                <a class="smallbtn" href={obr?.campaignUrl(s.campaign_id)} target="_blank" rel="noopener noreferrer">Open</a>
                {#if !campaignId}
                  <button class="smallbtn" onclick={() => addToRoom({ kind: 'campaign', id: s.campaign_id! })}>Add the campaign</button>
                {/if}
              </p>
            {/if}
            <div class="acts">
              <a class="btn" href={obr?.sheetUrl(s.id)} target="_blank" rel="noopener noreferrer">Open sheet</a>
              {#if onMap[s.id]?.length}
                <button class="btn" onclick={() => find(s)}>Find token</button>
              {/if}
              <button class="btn" disabled={busy === s.id} onclick={() => place(s)}>{busy === s.id ? 'Placing…' : onMap[s.id]?.length ? 'Another token' : 'Place token'}</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <section class="rolls">
      <h2>Rolls
        <InfoTip label="About rolls">Rolls made in a character’s dice tray on their sheet show up here and pop up for everyone in the room.</InfoTip>
      </h2>
      {#if rolls.length}
        <ol>
          {#each rolls as r (r.sheet + r.at)}
            {@const nat = natural(r)}
            <li class:crit={nat === 'crit'} class:fumble={nat === 'fumble'} animate:flip={{ duration: 260, easing: quintOut }} in:slide={ease()}>
              <span class="head">{headline(r)}</span>
              <span class="dice">{diceLine(r)} · {ago(r.at, tickNow)}</span>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="note">No rolls yet.</p>
      {/if}
    </section>

    <!-- Adding more: two buttons that give way to a field, in one box that
         eases to its new height so nothing below jumps. -->
    {#if loaded && campaignId}
      <section class="more smooth-height" use:smoothHeight>
        <div class="swap-cell">
          {#if adding}
            <div in:fade={{ duration: 200, delay: 90 }} out:fade={{ duration: 120 }}>{@render addForm(adding, false)}</div>
          {:else}
            <div class="morebtns" in:fade={{ duration: 200, delay: 90 }} out:fade={{ duration: 120 }}>
              <button class="smallbtn" onclick={() => startAdding('character')}>Add character</button>
              <button class="smallbtn" onclick={() => startAdding('campaign')}>Replace campaign</button>
            </div>
          {/if}
        </div>
      </section>
    {/if}

    <footer class="smooth-height" use:smoothHeight>
      <div class="swap-cell">
        {#if signing && !$session.user}
          <form class="signin" onsubmit={doSignIn} in:fade={{ duration: 200, delay: 90 }} out:fade={{ duration: 120 }}>
            <input type="email" bind:value={email} placeholder="Email" autocomplete="email" aria-label="Email" required />
            <input type="password" bind:value={password} placeholder="Password" autocomplete="current-password" aria-label="Password" required />
            <div class="row">
              <button class="go" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in'}</button>
              <button type="button" class="smallbtn" onclick={() => { signing = false; authError = null; }}>Cancel</button>
            </div>
            {#if authError}<p class="err" role="alert">{authError}</p>{/if}
          </form>
        {:else}
          <div class="who-row" in:fade={{ duration: 200, delay: 90 }} out:fade={{ duration: 120 }}>
            {#if $session.user}
              <span class="me">Signed in as {$session.user.email}
                <InfoTip label="What signing in does">You can change hit points from a token’s right-click menu and draw on the campaign’s board.</InfoTip>
              </span>
              <button class="smallbtn" onclick={() => signOut()}>Sign out</button>
            {:else}
              <span class="me">Not signed in
                <InfoTip label="Why sign in">
                  Sign in to change hit points from a token and draw on the board. Owlbear keeps its own sign-in; Google
                  accounts set a password on the account page first.
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
  .panel { padding: 1.125rem 1.125rem 1.5rem; font-size: 0.9375rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.125rem; }
  header { display: flex; align-items: center; gap: 0.5rem; color: var(--text); }
  header .brandname { font-size: 1.1875rem; }
  .note { margin: 0; color: var(--dim); font-size: 0.875rem; line-height: 1.5; }
  .note code { display: block; margin-top: 0.375rem; word-break: break-all; color: var(--text); }
  .err { margin: 0; color: var(--bad); font-size: 0.8125rem; line-height: 1.4; }

  .add { display: flex; gap: 0.5rem; align-items: center; }
  .start {
    display: grid; gap: 0.625rem; padding: 1rem; border: 1px solid var(--a-edge); border-radius: var(--r);
    background: color-mix(in oklch, var(--a) 6%, var(--surface));
  }
  .start .lead { margin: 0; font-size: 1rem; letter-spacing: 0.01em; text-transform: none; color: var(--text); }
  .more { display: grid; grid-template-columns: minmax(0, 1fr); }
  .morebtns { display: flex; justify-content: center; flex-wrap: wrap; gap: 0.5rem; padding: 0.125rem 0; }
  .add input { width: 0; }
  input {
    flex: 1; min-width: 0; font: inherit; font-size: 0.875rem; padding: 0.5rem 0.6875rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface);
    transition: border-color 0.15s ease;
  }
  input:hover { border-color: var(--a-edge); }
  input:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  button, .btn { font: inherit; cursor: pointer; }
  .go, .btn {
    border: 1px solid var(--line); background: var(--raised); color: var(--text); border-radius: var(--r-sm);
    padding: 0.4375rem 0.75rem; font-size: 0.875rem; text-decoration: none; white-space: nowrap;
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }
  .go:hover:not(:disabled), .btn:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .go:active:not(:disabled), .btn:active:not(:disabled) { transform: translateY(1px); }
  .go:focus-visible, .btn:focus-visible, .x:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .go:disabled, .btn:disabled { opacity: 0.5; cursor: default; }
  .x {
    margin-left: auto; width: 1.75rem; height: 1.75rem; border: 0; background: none; color: var(--faint); border-radius: 50%;
    font-size: 1rem; line-height: 1; padding: 0; display: grid; place-items: center; transition: color 0.15s ease, background-color 0.15s ease;
  }
  .x:hover { color: var(--danger, var(--bad)); background: var(--raised); }
  .x:active { transform: translateY(1px); }

  .group { display: grid; gap: 0.75rem; }
  h2 {
    margin: 0; display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; font-size: 0.75rem; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--label); font-weight: 600;
  }
  .camp { margin: 0; font-size: 0.8125rem; color: var(--dim); display: flex; flex-wrap: wrap; gap: 0.375rem 0.5rem; align-items: center; }
  .camp b { color: var(--text); font-weight: 600; }
  .chars { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.75rem; }
  .char {
    --hurt-red: oklch(66% 0.22 25);
    border: 1px solid var(--line-soft); border-radius: var(--r); background: var(--surface); padding: 0.875rem 1rem;
    display: grid; gap: 0.75rem; transition: border-color 0.3s ease;
  }
  .char:hover { border-color: var(--a-edge); }
  .char.bloodied { border-color: color-mix(in oklch, var(--hurt-red) 45%, var(--line-soft)); }
  .char.critical, .char.down { border-color: color-mix(in oklch, var(--hurt-red) 80%, transparent); }
  .char.dead { opacity: 0.7; }
  .top { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
  .portrait {
    position: relative; flex: none; width: 3rem; height: 3rem; border-radius: var(--r-sm);
    border: 1px solid var(--a-edge); background: linear-gradient(150deg, var(--portrait-from, var(--raised)), var(--portrait-to, var(--surface)));
    transition: border-color 0.35s ease;
  }
  .portrait.ringed { border-color: transparent; }
  .portrait img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
  .who { display: grid; min-width: 0; flex: 1; }
  .who { gap: 0.125rem; }
  .who strong { font-size: 1rem; overflow-wrap: anywhere; }
  .sub { font-size: 0.8125rem; color: var(--dim); overflow-wrap: anywhere; }
  .ac { display: grid; justify-items: center; line-height: 1.1; padding: 0.3125rem 0.5625rem; border: 1px solid var(--line-soft); border-radius: var(--r-sm); background: var(--raised); }
  .ac b { font-size: 1.0625rem; font-variant-numeric: tabular-nums; }
  .ac small { font-size: 0.5625rem; letter-spacing: 0.1em; color: var(--label); }


  .conds { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .conds li {
    display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.8125rem; padding: 0.125rem 0.5625rem;
    border-radius: 999px; border: 1px solid color-mix(in oklch, var(--cc, var(--line)) 55%, transparent);
    background: color-mix(in oklch, var(--cc, var(--raised)) 14%, transparent);
  }
  .conds .dot { width: 0.4375rem; height: 0.4375rem; border-radius: 50%; background: var(--cc, var(--faint)); }
  .conds .plain .dot { background: none; border: 1px solid var(--faint); }
  .acts { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .acts .btn { display: inline-flex; align-items: center; gap: 0.375rem; }
  .acts.room { align-items: center; }

  .rolls ol { list-style: none; margin: 0.625rem 0 0; padding: 0; display: grid; gap: 0.5rem; }
  .rolls li { display: grid; gap: 0.125rem; padding: 0.5rem 0.75rem; border-radius: var(--r-sm); background: var(--surface); border: 1px solid var(--line-soft); }
  .rolls li.crit { border-color: color-mix(in oklch, oklch(78% 0.15 80) 70%, transparent); }
  .rolls li.fumble { border-color: color-mix(in oklch, var(--bad) 60%, transparent); }
  .head { font-size: 0.875rem; }
  .dice { font-size: 0.75rem; color: var(--faint); }

  footer { font-size: 0.8125rem; color: var(--dim); border-top: 1px solid var(--line-soft); padding-top: 0.875rem; box-sizing: content-box; }
  /* Who is signed in on the left (with its bubble), the button on the right. */
  .who-row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .me { display: inline-flex; align-items: center; gap: 0.375rem; min-width: 0; overflow-wrap: anywhere; }
  .signin { display: grid; gap: 0.5rem; }
  .signin input { width: 100%; box-sizing: border-box; }
  .signin .row { display: flex; gap: 0.5rem; align-items: center; }
</style>
