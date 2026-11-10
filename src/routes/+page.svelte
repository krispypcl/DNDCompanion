<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import AuthForm from '$lib/components/AuthForm.svelte';
  import ModeToggle from '$lib/components/ModeToggle.svelte';
  import SoundToggle from '$lib/components/SoundToggle.svelte';
  import { sheetName, sheetRepo } from '$lib/data/sheets';
  import { campaignMessage, campaignRepo, type Campaign } from '$lib/data/campaigns';
  import { MAX_BYTES, importSheet } from '$lib/exchange';
  import { pinnedCampaignsOf, pinnedJoinedOf, pinnedOf, profileOf, savePinned, savePinnedCampaigns, savePinnedJoined, signIn, updateProfile } from '$lib/data/session';
  import { slide } from 'svelte/transition';
  import { tick } from 'svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import { friendlyError } from '$lib/errors';
  import { friendlyDate } from '$lib/rules/dates';
  import { faceFamily, fontFace } from '$lib/rules/fonts';
  import D20Loader from '$lib/components/D20Loader.svelte';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion, rise } from '$lib/motion';
  import { blankDefinition, blankState } from '$lib/sample';
  import { session } from '$lib/stores/session';
  import { isConfigured } from '$lib/supabase';
  import type { Sheet } from '$lib/types';

  // A player with no name yet is asked for one here; then, once, for a picture.
  let nameDraft = $state('');
  let savingName = $state(false);
  async function saveName() {
    const name = nameDraft.trim();
    if (!name || !$session.user) return;
    savingName = true;
    try {
      await updateProfile({ displayName: name, avatarUrl: profileOf($session.user).avatarUrl });
    } catch (e) {
      error = friendlyError(e, 'Your name didn’t stick! Try again.');
    } finally {
      savingName = false;
    }
  }
  const NUDGE_KEY = 'dndcompanion:picture-nudge';
  let pictureNudgeGone = $state(true);
  $effect(() => {
    try { pictureNudgeGone = localStorage.getItem(NUDGE_KEY) === 'gone'; } catch { pictureNudgeGone = false; }
  });
  function dismissPictureNudge() {
    pictureNudgeGone = true;
    try { localStorage.setItem(NUDGE_KEY, 'gone'); } catch { /* private window */ }
  }

  /** A deleted sheet folds away: fades, slides aside and closes its gap. */
  function fold(node: Element) {
    const h = (node as HTMLElement).offsetHeight;
    return {
      duration: prefersReducedMotion() ? 0 : 280,
      easing: cubicOut,
      css: (t: number, u: number) =>
        `opacity: ${t}; transform: translateX(${-12 * u}px); height: ${t * h}px; overflow: hidden;`
    };
  }

  /** Which of the three faces of this page is showing; signing in or out
      swaps one for another, and the swap is worth animating. */
  const view = $derived(
    !isConfigured ? 'list' : $session.loading ? 'loading' : $session.user ? 'list' : 'auth'
  );

  let sheets = $state<Sheet[]>([]);
  let loading = $state(false);
  /** The die has landed: the list shows. */
  let listShown = $state(false);
  let error = $state<string | null>(null);
  let creating = $state(false);
  /** id of the sheet awaiting confirmation; deleting is permanent. */
  let confirming = $state<string | null>(null);
  let deleting = $state<string | null>(null);
  let importing = $state(false);
  let picker = $state<HTMLInputElement>();
  /** Campaign names by id, for the sheets' cards; and the campaigns run here. */
  let campaignNames = $state(new Map<string, string>());
  let running = $state<Campaign[]>([]);
  /** The campaigns this player's characters are in, run by someone else. */
  let joined = $state<Campaign[]>([]);
  /** The fonts the DMs chose for their campaigns' names, each loaded once. */
  const campaignFaces = $derived([...new Set([...running, ...joined].map((c) => fontFace(c.details?.nameFont)?.href).filter(Boolean) as string[])]);
  let naming = $state(false);
  let newCampaign = $state('');
  let starting = $state(false);
  async function startCampaign() {
    if (!newCampaign.trim()) return;
    starting = true;
    error = null;
    try {
      const made = await campaignRepo.create(newCampaign.trim());
      await goto(`${base}/c/${made.id}`);
    } catch (e) {
      error = campaignMessage(e, 'The campaign wouldn’t start! Try again in a moment.');
    } finally {
      starting = false;
    }
  }
  /** What a sheet's card is called: its character's name, or the sheet's. */
  const nameOf = (sheet: Sheet) => sheet.definition?.identity?.name || sheet.name;
  /** The campaign a sheet's card names: its campaign's, or what was typed before campaigns. */
  const campaignOf = (sheet: Sheet) =>
    (sheet.campaign_id && campaignNames.get(sheet.campaign_id)) || sheet.definition?.identity?.campaign?.trim() || '';
  /** What the last import had to leave out, shown beside the new sheet. */
  let notice = $state<string | null>(null);

  /**
   * Pinned sheets and campaigns sit on top in the player's own order (pinned
   * sheets cannot be deleted until unpinned). The rest follow: sheets most
   * recently updated first, campaigns oldest first. Retired sheets and ended
   * campaigns go last, in a group of their own, pinned or not.
   */
  type Kind = 'sheets' | 'campaigns' | 'joined';
  let pinned = $state<string[]>([]);
  let pinnedCamps = $state<string[]>([]);
  let pinnedJoinedIds = $state<string[]>([]);
  $effect(() => {
    pinned = pinnedOf($session.user);
    pinnedCamps = pinnedCampaignsOf($session.user);
    pinnedJoinedIds = pinnedJoinedOf($session.user);
  });
  const pinsOf = (kind: Kind) => (kind === 'sheets' ? pinned : kind === 'campaigns' ? pinnedCamps : pinnedJoinedIds);
  function setPins(kind: Kind, ids: string[]) {
    if (kind === 'sheets') pinned = ids;
    else if (kind === 'campaigns') pinnedCamps = ids;
    else pinnedJoinedIds = ids;
  }
  const byId = $derived(new Map(sheets.map((s) => [s.id, s])));
  const pinnedSheets = $derived(pinned.map((id) => byId.get(id)).filter((s): s is Sheet => Boolean(s && !s.retired)));
  const byRecent = (a: Sheet, b: Sheet) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  const otherSheets = $derived(sheets.filter((s) => !s.retired && !pinned.includes(s.id)).sort(byRecent));
  const retiredSheets = $derived(sheets.filter((s) => s.retired).sort(byRecent));
  const campById = $derived(new Map(running.map((c) => [c.id, c])));
  const pinnedCampaigns = $derived(
    pinnedCamps.map((id) => campById.get(id)).filter((c): c is Campaign => Boolean(c && !c.archived))
  );
  const otherCampaigns = $derived(running.filter((c) => !c.archived && !pinnedCamps.includes(c.id)));
  const endedCampaigns = $derived(running.filter((c) => c.archived));
  const joinedById = $derived(new Map(joined.map((c) => [c.id, c])));
  const pinnedJoined = $derived(
    pinnedJoinedIds.map((id) => joinedById.get(id)).filter((c): c is Campaign => Boolean(c && !c.archived))
  );
  const otherJoined = $derived(joined.filter((c) => !c.archived && !pinnedJoinedIds.includes(c.id)));
  const endedJoined = $derived(joined.filter((c) => c.archived));
  /** This player's characters in a campaign (retired ones too: they were there). */
  const charactersIn = (c: Campaign) => sheets.filter((s) => s.campaign_id === c.id);

  async function setPinned(next: string[], kind: Kind = 'sheets') {
    const previous = pinsOf(kind);
    setPins(kind, next);
    try {
      await (kind === 'sheets' ? savePinned(next) : kind === 'campaigns' ? savePinnedCampaigns(next) : savePinnedJoined(next));
    } catch (e) {
      setPins(kind, previous);
      error = friendlyError(e, 'That pin didn’t stick! Try again in a moment.');
    }
  }
  function togglePin(id: string, kind: Kind = 'sheets') {
    if (confirming === id) confirming = null;
    const list = pinsOf(kind);
    void setPinned(list.includes(id) ? list.filter((p) => p !== id) : [...list, id], kind);
  }

  /**
   * Leaving a campaign from here takes every one of this player's characters
   * out of it, the way each sheet's own Leave does.
   */
  let leavingId = $state<string | null>(null);
  async function leave(c: Campaign) {
    leavingId = c.id;
    error = null;
    try {
      for (const s of charactersIn(c)) {
        const stamp = await sheetRepo.saveRow(s.id, { campaign_id: null }, s.updated_at);
        sheets = sheets.map((x) => (x.id === s.id ? { ...x, campaign_id: null, updated_at: stamp } : x));
      }
      joined = joined.filter((x) => x.id !== c.id);
      confirming = null;
    } catch (e) {
      error = friendlyError(e, 'The campaign held on to you! Try leaving again.');
    } finally {
      leavingId = null;
    }
  }

  // Dragging a pinned card by its grip, the same way table rows move.
  let rowEls = $state<Record<string, HTMLElement>>({});
  let drag = $state<{ kind: Kind; id: string; from: number; to: number; dy: number; height: number; middles: number[]; startY: number; pointerId: number } | null>(null);
  let landing = $state(false);
  const pinnedIds = (kind: Kind) => (kind === 'sheets' ? pinnedSheets : kind === 'campaigns' ? pinnedCampaigns : pinnedJoined).map((x) => x.id);
  function grab(event: PointerEvent, id: string, kind: Kind = 'sheets') {
    const ids = pinnedIds(kind);
    if (event.button !== 0 || ids.length < 2) return;
    event.preventDefault();
    const middles = ids.map((k) => {
      const r = rowEls[k]?.getBoundingClientRect();
      return r ? r.top + window.scrollY + r.height / 2 : 0;
    });
    const from = ids.indexOf(id);
    const gap = middles.length > 1 ? Math.abs(middles[1] - middles[0]) : (rowEls[id]?.offsetHeight ?? 0);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    drag = { kind, id, from, to: from, dy: 0, height: gap, middles, startY: event.clientY + window.scrollY, pointerId: event.pointerId };
  }
  function moveDrag(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dy = event.clientY + window.scrollY - drag.startY;
    const centre = drag.middles[drag.from] + dy;
    let to = 0;
    drag.middles.forEach((m, i) => { if (i !== drag!.from && m < centre) to += 1; });
    drag.dy = dy;
    drag.to = to;
  }
  async function dropDrag(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { from, to, kind } = drag;
    landing = true;
    drag = null;
    if (from !== to) {
      const ids = pinnedIds(kind);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      await setPinned(ids, kind);
    }
    await tick();
    requestAnimationFrame(() => (landing = false));
  }
  function shift(id: string): number {
    if (!drag) return 0;
    if (id === drag.id) return drag.dy;
    const i = pinnedIds(drag.kind).indexOf(id);
    if (i < 0) return 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -drag.height;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return drag.height;
    return 0;
  }

  /* By id, not by user: saving a pin or a profile updates the user, and
     that must not reload the whole list. */
  const userId = $derived($session.user?.id ?? null);
  $effect(() => {
    const id = userId;
    if (!id) {
      sheets = [];
      return;
    }
    loading = true;
    listShown = false;
    sheetRepo
      .listMySheets(id)
      .then((rows) => {
        sheets = rows;
        // The names of the campaigns they are in, and the ones this player runs.
        campaignRepo.names(rows.map((r) => r.campaign_id ?? '')).then((m) => (campaignNames = m)).catch(() => {});
        campaignRepo.mine(id).then((c) => (running = c)).catch(() => {});
        campaignRepo.byIds(rows.map((r) => r.campaign_id ?? ''))
          .then((cs) => (joined = cs.filter((c) => c.created_by !== id)))
          .catch(() => {});
      })
      .catch((e) => (error = friendlyError(e, 'Your sheets wouldn’t load! Try again in a moment.')))
      .finally(() => (loading = false));
  });

  async function remove(id: string) {
    deleting = id;
    error = null;
    try {
      await sheetRepo.deleteSheet(id);
      sheets = sheets.filter((s) => s.id !== id);
      confirming = null;
    } catch (e) {
      error = friendlyError(e, 'That sheet refused to leave! Try deleting it again.');
    } finally {
      deleting = null;
    }
  }

  /**
   * A file made by Export. It always becomes a new sheet: bringing a backup in
   * never overwrites a character that is already here.
   */
  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const user = $session.user;
    if (!file || !user) return;
    error = null;
    notice = null;
    if (file.size > MAX_BYTES) {
      error = 'That file is far too heavy to be a character sheet!';
      return;
    }
    importing = true;
    try {
      const result = importSheet(await file.text());
      if (!result.ok) {
        error = result.error;
        return;
      }
      const { definition, state, texts } = result.value;
      // Where the writing goes depends on whether the database can keep it
      // private: in its own rows if so, in the sheet as before if not.
      const separate = await sheetRepo.textsAvailable();
      // Without the table for it, nothing can be private, so nothing is marked so.
      const { privateText: _p, ...open } = definition;
      const stored = separate
        ? definition
        : { ...open, notes: texts.notes.body, backstory: texts.backstory.body };
      const sheet = await sheetRepo.createSheet(user.id, sheetName(stored), stored, state);
      if (separate) {
        for (const key of ['notes', 'backstory'] as const) {
          const t = texts[key];
          if (t.body === '' && t.isPublic) continue;
          try {
            await sheetRepo.saveText(sheet.id, user.id, key, t.body, t.isPublic, null);
          } catch (e) {
            error = `The sheet came in, but its ${key} didn’t make it! Open the sheet and paste it in again.`;
          }
        }
      }
      if (error || result.warnings.length) {
        sheets = [...sheets, sheet];
        notice = `Imported \u201c${sheetName(stored)}\u201d. ${result.warnings.join(' ')}`.trim();
        return;
      }
      await goto(`${base}/s/${sheet.id}`);
    } catch (e) {
      error = friendlyError(e, 'That file wouldn’t come in! Try exporting it again.');
    } finally {
      importing = false;
    }
  }

  async function create() {
    const user = $session.user;
    if (!user) return;
    creating = true;
    try {
      const sheet = await sheetRepo.createSheet(user.id, 'New character', blankDefinition(), blankState());
      await goto(`${base}/s/${sheet.id}`);
    } catch (e) {
      error = friendlyError(e, 'The new sheet fizzled! Try again in a moment.');
    } finally {
      creating = false;
    }
  }
</script>

{#snippet star(id: string, name: string, on: boolean, kind: Kind)}
  <!-- A star on the left: pinned cards go to the top (and sheets cannot be deleted). -->
  <button class="star" class:on aria-pressed={on}
          aria-label="{on ? 'Unpin' : 'Pin'} {name}"
          title={on ? 'Unpin' : 'Pin to the top'} onclick={() => togglePin(id, kind)}>
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6-4.5-4.2 6.1-.7z"
            stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
    </svg>
  </button>
{/snippet}

{#snippet pin(sheet: Sheet, on: boolean)}
  {@render star(sheet.id, nameOf(sheet), on, 'sheets')}
{/snippet}

{#snippet grip(id: string, name: string, count: number, kind: Kind)}
  <button class="grip" aria-label="Drag to reorder {name}"
          title="Drag to reorder" disabled={count < 2}
          onpointerdown={(e) => grab(e, id, kind)} onpointermove={moveDrag}
          onpointerup={dropDrag} onpointercancel={() => (drag = null)}>
    <svg viewBox="0 0 12 18" width="10" height="15" aria-hidden="true">
      {#each [3, 9, 15] as y (y)}
        <circle cx="3" cy={y} r="1.5" fill="currentColor" /><circle cx="9" cy={y} r="1.5" fill="currentColor" />
      {/each}
    </svg>
  </button>
{/snippet}

{#snippet campcard(c: Campaign)}
  <a href="{base}/c/{c.id}"><strong style:font-family={faceFamily(fontFace(c.details?.nameFont))}>{c.name}</strong><span class="meta">started {friendlyDate(c.created_at)}{#if c.archived}{' '}· ended{/if}</span></a>
{/snippet}

{#snippet joinedcard(c: Campaign)}
  {@const mine = charactersIn(c).map(nameOf)}
  <a href="{base}/c/{c.id}"><strong style:font-family={faceFamily(fontFace(c.details?.nameFont))}>{c.name}</strong><span class="meta">{#if mine.length}as {mine.length > 1 ? `${mine.slice(0, -1).join(', ')} and ${mine.at(-1)}` : mine[0]}{' · '}{/if}started {friendlyDate(c.created_at)}{#if c.archived}{' '}· ended{/if}</span></a>
{/snippet}

{#snippet joinedrow(c: Campaign)}
  <!-- A campaign not pinned: its star (none once ended), its card, and leaving it. -->
  {#if !c.archived}{@render star(c.id, c.name, false, 'joined')}{/if}
  {@render joinedcard(c)}
  {#if confirming === c.id}
    <div class="confirm" role="group" aria-label="Confirm leaving {c.name}">
      <span>Leave with {charactersIn(c).length > 1 ? 'all your characters' : 'your character'}?</span>
      <button class="danger" disabled={leavingId === c.id} onclick={() => leave(c)}>
        {leavingId === c.id ? 'Leaving…' : 'Leave'}
      </button>
      <button class="ghost" onclick={() => (confirming = null)}>Stay</button>
    </div>
  {:else}
    <button class="trash" aria-label="Leave {c.name}" title="Leave the campaign"
            onclick={() => (confirming = c.id)}>×</button>
  {/if}
{/snippet}

{#snippet card(sheet: Sheet)}
  <a href="{base}/s/{sheet.id}">
    <strong>{nameOf(sheet)}{#if campaignOf(sheet)}
      <span class="campaign">· {campaignOf(sheet)}</span>{/if}</strong>
    <span class="meta">
      {[sheet.definition?.identity?.subclass, sheet.definition?.identity?.class]
        .filter(Boolean)
        .join(' ') || 'No class'}
      {#if sheet.definition?.identity?.level}· level {sheet.definition.identity.level}{/if}
      <span class="dates">
        · created {friendlyDate(sheet.created_at)} · updated {friendlyDate(sheet.updated_at)}
      </span>
    </span>
  </a>
{/snippet}

{#snippet row(sheet: Sheet)}
  <!-- A sheet that is not pinned: its star (none once retired), its card, and deleting it. -->
  {#if !sheet.retired}{@render pin(sheet, false)}{/if}
  {@render card(sheet)}
  {#if confirming === sheet.id}
    <div class="confirm" role="group" aria-label="Confirm deleting {nameOf(sheet)}">
      <span>Delete for good?</span>
      <button class="danger" disabled={deleting === sheet.id} onclick={() => remove(sheet.id)}>
        {deleting === sheet.id ? 'Deleting…' : 'Delete'}
      </button>
      <button class="ghost" onclick={() => (confirming = null)}>Keep</button>
    </div>
  {:else}
    <button class="trash" aria-label="Delete {nameOf(sheet)}"
            onclick={() => (confirming = sheet.id)}>×</button>
  {/if}
{/snippet}

<svelte:head>
  <title>DND Companion</title>
  {#each campaignFaces as href (href)}<link rel="stylesheet" {href} />{/each}
</svelte:head>

{#key view}
<div class="swap" in:rise={{ y: 10, duration: 240, delay: 30 }}>
{#if view === 'auth'}
  <AuthForm
    google
    name="Sign in"
    submitLabel="Sign in"
    fields={[
      { id: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
      { id: 'password', label: 'Password', type: 'password', autocomplete: 'current-password' }
    ]}
    onsubmit={async (v) => {
      await signIn(v.email, v.password);
    }}
  >
    <a href="{base}/signup">Create an account</a>
    <a href="{base}/reset">Forgot password</a>
  </AuthForm>
{:else}
<main>
  <header>
    <h1><Logo size={30} /><span class="brandname">DND Companion</span></h1>
    <div class="tools">
      <SoundToggle />
      <ModeToggle />
      {#if $session.user}
        {@const me = profileOf($session.user)}
        <a class="me" href="{base}/account" title="Your account">
          <Avatar url={me.avatarUrl} name={me.displayName || $session.user.email || '?'} size={30} />
          <span>{me.displayName || 'Account'}</span>
        </a>
      {/if}
    </div>
  </header>

  {#if !isConfigured}
    <p class="warn">
      This copy has no Supabase credentials. Set <code>PUBLIC_SUPABASE_URL</code> and
      <code>PUBLIC_SUPABASE_ANON_KEY</code> and rebuild.
    </p>
  {:else if $session.loading}
    <div class="dieload screen-center"><D20Loader size={56} label="Signing in" /></div>
  {:else}
    <div class="bar">
      <h2>Your characters</h2>
      <div class="actions">
        <!-- Visually hidden, not display: none: some phones will not open the
             file picker for an input that is not rendered. -->
        <input
          bind:this={picker}
          class="file"
          type="file"
          accept=".txt,text/plain"
          aria-label="Import a sheet file"
          tabindex="-1"
          onchange={importFile}
        />
        <button class="ghost" onclick={() => picker?.click()} disabled={importing}
                title="Bring back a sheet saved with Export">
          {importing ? 'Importing…' : 'Import'}
        </button>
        <button onclick={create} disabled={creating}>{creating ? 'Creating…' : 'New sheet'}</button>
      </div>
    </div>

    {#if $session.user}
      {@const me = profileOf($session.user)}
      {#if !me.displayName}
        <!-- No name yet: the table needs something to call them. -->
        <form class="hello" transition:slide={{ duration: 260 }} onsubmit={(e) => { e.preventDefault(); void saveName(); }}>
          <div class="hellotext">
            <b>What should the table call you?</b>
            <span>Your name shows on your campaigns and to your DM. A profile picture helps too; add one on your account page.</span>
          </div>
          <div class="hellorow">
            <input bind:value={nameDraft} placeholder="Your name" aria-label="Your name" maxlength="60" />
            <button disabled={!nameDraft.trim() || savingName}>{savingName ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      {:else if !me.avatarUrl && !pictureNudgeGone}
        <div class="hello slim" transition:slide={{ duration: 260 }}>
          <span>Add a profile picture, {me.displayName.split(' ')[0]}? It is how the rest of the table spots you.</span>
          <a class="hellolink" href="{base}/account">Add one</a>
          <button class="ghost" onclick={dismissPictureNudge} aria-label="Not now">Not now</button>
        </div>
      {/if}
    {/if}

    {#if error}<p class="warn" role="alert">{error}</p>{/if}
    {#if notice}<p class="note" role="status">{notice}</p>{/if}

    {#if loading || !listShown}
      <div class="dieload screen-center">
        <D20Loader size={56} label="Loading your characters" result={loading ? null : error ? 1 : 20}
                   onlanded={() => (listShown = true)} />
      </div>
    {:else if sheets.length === 0}
      <p class="dim">No characters yet. Make one and start filling it in.</p>
    {:else}
      {#if pinnedSheets.length}
        <h3 class="group">Pinned</h3>
        <ul class="pinned cascade" class:dragging={drag?.kind === 'sheets'} class:landing>
          {#each pinnedSheets as sheet, i (sheet.id)}
            <li style:--i={i} bind:this={rowEls[sheet.id]} class:lifted={drag?.id === sheet.id}
                style:transform={drag ? `translateY(${shift(sheet.id)}px)` : undefined}
                animate:flip={{ duration: drag || landing ? 0 : 260, easing: cubicOut }} out:fold>
              {@render pin(sheet, true)}
              {@render card(sheet)}
              {@render grip(sheet.id, nameOf(sheet), pinnedSheets.length, 'sheets')}
            </li>
          {/each}
        </ul>
      {/if}
      {#if otherSheets.length && (pinnedSheets.length || retiredSheets.length)}<h3 class="group">Everything else</h3>{/if}
      <ul class="cascade">
        {#each otherSheets as sheet, i (sheet.id)}
          <li style:--i={i} animate:flip={{ duration: 260, easing: cubicOut }} out:fold>{@render row(sheet)}</li>
        {/each}
      </ul>
      {#if retiredSheets.length}
        <h3 class="group">Retired</h3>
        <ul class="cascade">
          {#each retiredSheets as sheet, i (sheet.id)}
            <li style:--i={i} class="retired" animate:flip={{ duration: 260, easing: cubicOut }} out:fold>{@render row(sheet)}</li>
          {/each}
        </ul>
      {/if}
    {/if}

    <!-- The campaigns this player's characters are in, run by someone else:
         one card each, however many of their characters are in it. -->
    {#if listShown && joined.length}
      <div class="bar campaigns">
        <h2>Campaigns you’re in</h2>
      </div>
      {#if pinnedJoined.length}
        <h3 class="group">Pinned</h3>
        <ul class="pinned cascade" class:dragging={drag?.kind === 'joined'} class:landing>
          {#each pinnedJoined as c, i (c.id)}
            <li style:--i={i} bind:this={rowEls[c.id]} class:lifted={drag?.id === c.id}
                style:transform={drag?.kind === 'joined' ? `translateY(${shift(c.id)}px)` : undefined}
                animate:flip={{ duration: drag || landing ? 0 : 260, easing: cubicOut }} out:fold>
              {@render star(c.id, c.name, true, 'joined')}
              {@render joinedcard(c)}
              {@render grip(c.id, c.name, pinnedJoined.length, 'joined')}
            </li>
          {/each}
        </ul>
      {/if}
      {#if otherJoined.length && (pinnedJoined.length || endedJoined.length)}<h3 class="group">Everything else</h3>{/if}
      <ul class="cascade">
        {#each otherJoined as c, i (c.id)}
          <li style:--i={i} animate:flip={{ duration: 260, easing: cubicOut }} out:fold>{@render joinedrow(c)}</li>
        {/each}
      </ul>
      {#if endedJoined.length}
        <h3 class="group">Archived</h3>
        <ul class="cascade">
          {#each endedJoined as c, i (c.id)}
            <li style:--i={i} class="retired" animate:flip={{ duration: 260, easing: cubicOut }} out:fold>{@render joinedrow(c)}</li>
          {/each}
        </ul>
      {/if}
    {/if}

    <!-- The campaigns this player runs as DM, and starting a new one. -->
    {#if listShown}
      <div class="bar campaigns">
        <h2>Campaigns you run</h2>
        <div class="actions">
          {#if !naming}<button class="ghost" onclick={() => (naming = true)}>New campaign</button>{/if}
        </div>
      </div>
      {#if naming}
        <div class="newcamp" in:rise>
          <!-- svelte-ignore a11y_autofocus -->
          <input bind:value={newCampaign} placeholder="Campaign name" aria-label="Campaign name" autofocus
                 onkeydown={(e) => { if (e.key === 'Enter') startCampaign(); if (e.key === 'Escape') naming = false; }} />
          <button onclick={startCampaign} disabled={starting || !newCampaign.trim()}>{starting ? 'Starting…' : 'Start'}</button>
          <button class="ghost" onclick={() => (naming = false)}>Cancel</button>
        </div>
      {/if}
      {#if running.length}
        {#if pinnedCampaigns.length}
          <h3 class="group">Pinned</h3>
          <ul class="pinned cascade" class:dragging={drag?.kind === 'campaigns'} class:landing>
            {#each pinnedCampaigns as c, i (c.id)}
              <li style:--i={i} bind:this={rowEls[c.id]} class:lifted={drag?.id === c.id}
                  style:transform={drag?.kind === 'campaigns' ? `translateY(${shift(c.id)}px)` : undefined}
                  animate:flip={{ duration: drag || landing ? 0 : 260, easing: cubicOut }}>
                {@render star(c.id, c.name, true, 'campaigns')}
                {@render campcard(c)}
                {@render grip(c.id, c.name, pinnedCampaigns.length, 'campaigns')}
              </li>
            {/each}
          </ul>
        {/if}
        {#if otherCampaigns.length && (pinnedCampaigns.length || endedCampaigns.length)}<h3 class="group">Everything else</h3>{/if}
        <ul class="cascade">
          {#each otherCampaigns as c, i (c.id)}
            <li style:--i={i} animate:flip={{ duration: 260, easing: cubicOut }}>
              {@render star(c.id, c.name, false, 'campaigns')}
              {@render campcard(c)}
            </li>
          {/each}
        </ul>
        {#if endedCampaigns.length}
          <h3 class="group">Archived</h3>
          <ul class="cascade">
            {#each endedCampaigns as c, i (c.id)}
              <li style:--i={i} class="retired" animate:flip={{ duration: 260, easing: cubicOut }}>{@render campcard(c)}</li>
            {/each}
          </ul>
        {/if}
      {:else if !naming}
        <p class="dim">None yet. Start one to get an invite link for your players.</p>
      {/if}
    {/if}
  {/if}
</main>
{/if}
</div>
{/key}

<style>
  .hello {
    display: flex; align-items: center; gap: 0.75rem 1rem; flex-wrap: wrap; margin: 0 0 1.25rem; padding: 0.875rem 1rem;
    border: 1px solid var(--a-edge); border-radius: var(--r); background: var(--a-wash);
  }
  .hello.slim { border-color: var(--line-soft); background: var(--surface); font-size: 0.875rem; color: var(--dim); }
  .hello.slim span { flex: 1; min-width: 12rem; }
  .hellotext { flex: 1 1 16rem; display: grid; gap: 0.125rem; }
  .hellotext span { font-size: 0.8125rem; color: var(--dim); line-height: 1.45; }
  .hellorow { display: flex; gap: 0.5rem; flex: 1 1 16rem; }
  .hellorow input {
    flex: 1; min-width: 0; font: inherit; padding: 0.4375rem 0.625rem; color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--bg);
  }
  .hellorow input:focus { outline: none; border-color: var(--a-edge); }
  .hellolink { color: var(--a); font-size: 0.875rem; }
  main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1rem 4rem; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .tools { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  /* The title takes the room the buttons leave and its name is sized to fit
     it, so a narrow phone shows all of "DND Companion" a little smaller
     rather than cut short ("DND COMPA…"). */
  h1 {
    font-size: 1.5rem; margin: 0; display: flex; align-items: center; gap: 0.625rem;
    flex: 1 1 auto; min-width: 0; container-type: inline-size;
  }
  h1 .brandname { font-size: min(1em, calc((100cqi - 2.5rem) / 10.2)); }
  h1 :global(.logo) { flex: none; }
  h2 { font-size: 0.75rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dim); margin: 0; }
  .bar { display: flex; align-items: center; justify-content: space-between; margin: 2rem 0 0.75rem; }
  .actions { display: flex; gap: 0.5rem; }
  .file {
    position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0;
    clip-path: inset(50%); pointer-events: none;
  }
  .note { color: var(--dim); font-size: 0.875rem; }
  button {
    background: var(--surface); border: 1px solid var(--line); color: var(--text);
    border-radius: 6px; padding: 0.4rem 0.9rem; font: inherit; font-size: 0.875rem; cursor: pointer;
  }
  button {
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.08s ease;
  }
  button:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  button:active:not(:disabled) { transform: translateY(1px); }
  .ghost { color: var(--dim); }
  .ghost:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  @keyframes rise {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
  /* Rows arrive in order; past the sixth they are all but simultaneous. */
  li { animation: rise 0.28s cubic-bezier(0.2, 0.7, 0.3, 1) backwards; }
  li:nth-child(2) { animation-delay: 0.04s; }
  li:nth-child(3) { animation-delay: 0.08s; }
  li:nth-child(4) { animation-delay: 0.12s; }
  li:nth-child(5) { animation-delay: 0.16s; }
  li:nth-child(n + 6) { animation-delay: 0.2s; }
  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    padding-right: 0.5rem;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  li:hover { border-color: var(--a-edge); transform: translateY(-1px); box-shadow: 0 6px 18px -8px rgb(0 0 0 / 0.45); }
  li a {
    display: block; flex: 1; min-width: 0;
    padding: 0.75rem 0.9rem; text-decoration: none; color: inherit;
  }
  .trash {
    background: none; border: 0; color: var(--dim); font-size: 1.1rem; line-height: 1;
    padding: 0.3rem 0.45rem; cursor: pointer; flex: none; border-radius: 5px;
  }
  .trash:hover { color: var(--bad); border-color: transparent; }
  .confirm { display: flex; align-items: center; gap: 0.5rem; flex: none; font-size: 0.82rem; }
  .confirm span { color: var(--dim); }
  .danger { border-color: var(--bad); color: var(--bad); padding: 0.25rem 0.6rem; font-size: 0.82rem; }
  .danger:hover:not(:disabled) { background: var(--bad); color: var(--bg); border-color: var(--bad); }
  .retired a { opacity: 0.6; padding-left: 0.9rem; }
  .meta { display: block; font-size: 0.8rem; color: var(--dim); margin-top: 0.15rem; }
  .campaign { font-weight: 400; color: var(--dim); margin-left: 0.25rem; }
  .bar.campaigns { margin-top: 2.5rem; }
  .newcamp { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
  .newcamp input {
    flex: 1; min-width: 0; font: inherit; padding: 0.5rem 0.75rem; border: 1px solid var(--line);
    border-radius: var(--r-sm); background: var(--surface); color: var(--text);
  }
  .newcamp input:focus { outline: none; border-color: var(--a-edge); }
  .dates { color: var(--faint); }
  .me {
    display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--text);
    font-size: 0.875rem; padding: 0.1875rem 0.75rem 0.1875rem 0.1875rem; border-radius: 999px;
    border: 1px solid var(--line); background: var(--raised);
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .me:hover { border-color: var(--a-edge); color: var(--a); }
  .dieload { min-height: 40vh; }
  .dim { color: var(--dim); }
  .warn { color: var(--accent); font-size: 0.9rem; }
  code { font-size: 0.85em; }
  li a { padding-left: 0.25rem; }
  .group {
    font-size: 0.6875rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint);
    font-weight: 600; margin: 1rem 0 0.5rem;
  }
  .group:first-of-type { margin-top: 0; }
  ul.pinned { margin-bottom: 0.25rem; }
  .star {
    flex: none; background: none; border: 0; padding: 0.5rem 0 0.5rem 0.75rem; cursor: pointer;
    color: var(--faint); display: grid; place-items: center;
    transition: color 0.15s ease, transform 0.2s cubic-bezier(0.3, 1.5, 0.5, 1);
  }
  .star svg { fill: none; transition: fill 0.2s ease; }
  .star:hover { color: var(--a); transform: scale(1.15); }
  .star.on { color: oklch(84% 0.15 90); }
  .star.on svg { fill: currentColor; animation: starPop 0.4s cubic-bezier(0.3, 1.6, 0.5, 1); }
  @keyframes starPop { from { transform: scale(0.4) rotate(-40deg); } }
  :global([data-mode='light']) .star.on { color: oklch(66% 0.16 80); }
  .grip {
    flex: none; background: none; border: 0; color: var(--faint); cursor: grab; touch-action: none;
    padding: 0.5rem 0.5rem; border-radius: 5px; display: grid; place-items: center;
  }
  .grip:hover:not(:disabled) { color: var(--text); }
  .grip:disabled { opacity: 0.35; cursor: default; }
  /* With a mouse, the star and the delete (or grip) wait until the card is
     pointed at, then slide in from their own sides. On a touch screen there is
     no pointing, so they stay, quietly. */
  @media (hover: hover) and (pointer: fine) {
    .star, .trash, .grip {
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.8, 0.3, 1), color 0.15s ease;
    }
    .star { transform: translateX(-6px) scale(0.8); }
    .trash, .grip { transform: translateX(6px) scale(0.8); }
    li:hover .star, li:focus-within .star,
    li:hover .trash, li:focus-within .trash,
    li:hover .grip, li:focus-within .grip, .dragging li.lifted .grip {
      opacity: 1; transform: none;
    }
    li:hover .trash, li:hover .grip { transition-delay: 0.04s; }
    li .star:hover { transform: scale(1.15); }
  }
  .dragging li { transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.3, 1); }
  .dragging li.lifted { transition: none; z-index: 2; position: relative; box-shadow: 0 12px 28px -10px rgb(0 0 0 / 0.6); border-color: var(--a-edge); cursor: grabbing; }
  @media (max-width: 420px) {
    h1 { font-size: 1.3125rem; gap: 0.5rem; }
    header { gap: 0.625rem; }
    .tools { gap: 0.375rem; }
    /* The picture alone says whose account it is: a round button, no pill. */
    .me span { display: none; }
    .me { padding: 0; border: 0; background: none; border-radius: 50%; }
    .me :global(.avatar) { width: 2.25rem; height: 2.25rem; transition: box-shadow 0.15s ease; }
    .me:hover :global(.avatar), .me:focus-visible :global(.avatar) { box-shadow: 0 0 0 2px var(--a-edge); }
  }
</style>
