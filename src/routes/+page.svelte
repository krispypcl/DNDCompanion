<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import AuthForm from '$lib/components/AuthForm.svelte';
  import ModeToggle from '$lib/components/ModeToggle.svelte';
  import { sheetName, sheetRepo } from '$lib/data/sheets';
  import { MAX_BYTES, importSheet } from '$lib/exchange';
  import { pinnedOf, profileOf, savePinned, signIn } from '$lib/data/session';
  import { tick } from 'svelte';
  import Avatar from '$lib/components/Avatar.svelte';
  import Logo from '$lib/components/Logo.svelte';
  import { friendlyError } from '$lib/errors';
  import { friendlyDate } from '$lib/rules/dates';
  import D20Loader from '$lib/components/D20Loader.svelte';
  import { flip } from 'svelte/animate';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';

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
  import { blankDefinition, blankState } from '$lib/sample';
  import { session } from '$lib/stores/session';
  import { isConfigured } from '$lib/supabase';
  import { rise } from '$lib/motion';
  import type { Sheet } from '$lib/types';

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
  /** What the last import had to leave out, shown beside the new sheet. */
  let notice = $state<string | null>(null);

  /**
   * Pinned sheets sit on top in the player's own order and cannot be deleted
   * until unpinned. The rest follow, most recently updated first.
   */
  let pinned = $state<string[]>([]);
  $effect(() => {
    pinned = pinnedOf($session.user);
  });
  const byId = $derived(new Map(sheets.map((s) => [s.id, s])));
  const pinnedSheets = $derived(pinned.map((id) => byId.get(id)).filter((s): s is Sheet => Boolean(s)));
  const otherSheets = $derived(
    sheets
      .filter((s) => !pinned.includes(s.id))
      .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
  );

  async function setPinned(next: string[]) {
    const previous = pinned;
    pinned = next;
    try {
      await savePinned(next);
    } catch (e) {
      pinned = previous;
      error = friendlyError(e, 'That pin didn’t stick! Try again in a moment.');
    }
  }
  function togglePin(id: string) {
    if (confirming === id) confirming = null;
    void setPinned(pinned.includes(id) ? pinned.filter((p) => p !== id) : [...pinned, id]);
  }

  // Dragging a pinned sheet by its grip, the same way table rows move.
  let rowEls = $state<Record<string, HTMLElement>>({});
  let drag = $state<{ id: string; from: number; to: number; dy: number; height: number; middles: number[]; startY: number; pointerId: number } | null>(null);
  let landing = $state(false);
  function grab(event: PointerEvent, id: string) {
    if (event.button !== 0 || pinnedSheets.length < 2) return;
    event.preventDefault();
    const ids = pinnedSheets.map((s) => s.id);
    const middles = ids.map((k) => {
      const r = rowEls[k]?.getBoundingClientRect();
      return r ? r.top + window.scrollY + r.height / 2 : 0;
    });
    const from = ids.indexOf(id);
    const gap = middles.length > 1 ? Math.abs(middles[1] - middles[0]) : (rowEls[id]?.offsetHeight ?? 0);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    drag = { id, from, to: from, dy: 0, height: gap, middles, startY: event.clientY + window.scrollY, pointerId: event.pointerId };
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
    const { from, to } = drag;
    landing = true;
    drag = null;
    if (from !== to) {
      const ids = pinnedSheets.map((s) => s.id);
      const [moved] = ids.splice(from, 1);
      ids.splice(to, 0, moved);
      await setPinned(ids);
    }
    await tick();
    requestAnimationFrame(() => (landing = false));
  }
  function shift(id: string): number {
    if (!drag) return 0;
    if (id === drag.id) return drag.dy;
    const i = pinnedSheets.findIndex((s) => s.id === id);
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
      .then((rows) => (sheets = rows))
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

{#snippet pin(sheet: Sheet, on: boolean)}
  <!-- A star on the left: pinned sheets go to the top and cannot be deleted. -->
  <button class="star" class:on aria-pressed={on}
          aria-label="{on ? 'Unpin' : 'Pin'} {sheet.definition?.identity?.name || sheet.name}"
          title={on ? 'Unpin' : 'Pin to the top'} onclick={() => togglePin(sheet.id)}>
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3.1-5.4 3.1 1.2-6-4.5-4.2 6.1-.7z"
            stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
    </svg>
  </button>
{/snippet}

{#snippet card(sheet: Sheet)}
  <a href="{base}/s/{sheet.id}">
    <strong>{sheet.definition?.identity?.name || sheet.name}</strong>
    <span class="meta">
      {[sheet.definition?.identity?.subclass, sheet.definition?.identity?.class]
        .filter(Boolean)
        .join(' ') || 'No class'}
      {#if sheet.definition?.identity?.level}· level {sheet.definition.identity.level}{/if}
      {#if sheet.retired}· retired{/if}
      <span class="dates">
        · created {friendlyDate(sheet.created_at)} · updated {friendlyDate(sheet.updated_at)}
      </span>
    </span>
  </a>
{/snippet}

<svelte:head><title>DND Companion</title></svelte:head>

{#key view}
<div class="swap" in:rise={{ y: 10, duration: 240, delay: 30 }}>
{#if view === 'auth'}
  <AuthForm
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
    <h1><Logo size={30} />DND Companion</h1>
    <div class="tools">
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
    <div class="dieload"><D20Loader size={56} label="Signing in" /></div>
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

    {#if error}<p class="warn" role="alert">{error}</p>{/if}
    {#if notice}<p class="note" role="status">{notice}</p>{/if}

    {#if loading || !listShown}
      <div class="dieload">
        <D20Loader size={56} label="Loading your characters" result={loading ? null : error ? 1 : 20}
                   onlanded={() => (listShown = true)} />
      </div>
    {:else if sheets.length === 0}
      <p class="dim">No characters yet. Make one and start filling it in.</p>
    {:else}
      {#if pinnedSheets.length}
        <h3 class="group">Pinned</h3>
        <ul class="pinned" class:dragging={drag} class:landing>
          {#each pinnedSheets as sheet (sheet.id)}
            <li bind:this={rowEls[sheet.id]} class:retired={sheet.retired} class:lifted={drag?.id === sheet.id}
                style:transform={drag ? `translateY(${shift(sheet.id)}px)` : undefined}
                animate:flip={{ duration: drag || landing ? 0 : 260, easing: cubicOut }} out:fold>
              {@render pin(sheet, true)}
              {@render card(sheet)}
              <button class="grip" aria-label="Drag to reorder {sheet.definition?.identity?.name || sheet.name}"
                      title="Drag to reorder" disabled={pinnedSheets.length < 2}
                      onpointerdown={(e) => grab(e, sheet.id)} onpointermove={moveDrag}
                      onpointerup={dropDrag} onpointercancel={() => (drag = null)}>
                <svg viewBox="0 0 12 18" width="10" height="15" aria-hidden="true">
                  {#each [3, 9, 15] as y (y)}
                    <circle cx="3" cy={y} r="1.5" fill="currentColor" /><circle cx="9" cy={y} r="1.5" fill="currentColor" />
                  {/each}
                </svg>
              </button>
            </li>
          {/each}
        </ul>
        {#if otherSheets.length}<h3 class="group">Everything else</h3>{/if}
      {/if}
      <ul>
        {#each otherSheets as sheet (sheet.id)}
          <li class:retired={sheet.retired} animate:flip={{ duration: 260, easing: cubicOut }} out:fold>
            {@render pin(sheet, false)}
            {@render card(sheet)}
            {#if confirming === sheet.id}
              <div class="confirm" role="group" aria-label="Confirm deleting {sheet.definition?.identity?.name || sheet.name}">
                <span>Delete for good?</span>
                <button
                  class="danger"
                  disabled={deleting === sheet.id}
                  onclick={() => remove(sheet.id)}
                >
                  {deleting === sheet.id ? 'Deleting…' : 'Delete'}
                </button>
                <button class="ghost" onclick={() => (confirming = null)}>Keep</button>
              </div>
            {:else}
              <button
                class="trash"
                aria-label="Delete {sheet.definition?.identity?.name || sheet.name}"
                onclick={() => (confirming = sheet.id)}
              >
                ×
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</main>
{/if}
</div>
{/key}

<style>
  main { max-width: 42rem; margin: 0 auto; padding: 2.5rem 1rem 4rem; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  .tools { display: flex; align-items: center; gap: 0.5rem; flex: none; }
  h1 { font-size: 1.5rem; margin: 0; display: flex; align-items: center; gap: 0.625rem; min-width: 0; }
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
  .retired a { opacity: 0.6; }
  .meta { display: block; font-size: 0.8rem; color: var(--dim); margin-top: 0.15rem; }
  .dates { color: var(--faint); }
  .me {
    display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--text);
    font-size: 0.875rem; padding: 0.1875rem 0.75rem 0.1875rem 0.1875rem; border-radius: 999px;
    border: 1px solid var(--line); background: var(--raised);
    transition: border-color 0.15s ease, color 0.15s ease;
  }
  .me:hover { border-color: var(--a-edge); color: var(--a); }
  .dieload { display: grid; place-items: center; padding: 3rem 0; }
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
    /* The picture alone says whose account it is: a round button, no pill. */
    .me span { display: none; }
    .me { padding: 0; border: 0; background: none; border-radius: 50%; }
    .me :global(.avatar) { width: 2.25rem; height: 2.25rem; transition: box-shadow 0.15s ease; }
    .me:hover :global(.avatar), .me:focus-visible :global(.avatar) { box-shadow: 0 0 0 2px var(--a-edge); }
  }
</style>
