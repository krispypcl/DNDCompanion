<!--
  The search: / on a sheet or a campaign page, or its button in the header.
  Type a name; every spell, item, feat, option, species, background, class,
  subclass, condition, and monster on 5e.tools is there, best matches first.
  Enter (or a press) opens one in a pop-up of its own, and the search stays
  for the next, its field still ready to type in (on a phone it steps aside,
  and its × stands in for Esc). On the campaign page the DM can also put a
  monster, or one of their own homebrew creatures, on the table.
-->
<script lang="ts">
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { backdrop, portal } from '#lib/actions.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import { peek, themeAt } from '#lib/stores/peek.svelte.ts';
  import { matchRank, search, type Hit, type IndexRow } from '#lib/rules/spotlight.ts';
  import { debounce } from '#lib/debounce.ts';

  type Homebrew = { id: string; name: string; kind: string };
  let {
    open = $bindable(false),
    onadd,
    homebrew = [],
    onaddhomebrew
  }: {
    open?: boolean;
    /** The DM's campaign page: put this monster on the table. */
    onadd?: (hit: Hit) => void;
    /** The DM's own creatures, searched too (campaign page). */
    homebrew?: Homebrew[];
    onaddhomebrew?: (id: string) => void;
  } = $props();

  let rows = $state<IndexRow[] | null>(null);
  let failed = $state(false);
  let query = $state('');
  let at = $state(0);
  let input = $state<HTMLInputElement>();
  let list = $state<HTMLElement>();

  // The index is big: loaded the first time the search opens, then kept.
  $effect(() => {
    if (!open || rows || failed) return;
    import('#lib/data/search-index.json')
      .then((m) => (rows = m.default as IndexRow[]))
      .catch(() => (failed = true));
  });
  $effect(() => {
    if (open) queueMicrotask(() => input?.select());
  });

  /**
   * What is searched: the field's words once typing pauses for a breath, so
   * the ten thousand entries aren't searched again for every letter. Enter
   * searches at once (flush) before choosing.
   */
  let searched = $state('');
  const settle = debounce((q: string) => (searched = q), 120);
  $effect(() => {
    const q = query;
    if (q.trim().length < 2) {
      settle.cancel();
      searched = q;
    } else settle(q);
  });
  $effect(() => () => settle.cancel());

  type Row = { kind: 'entry'; hit: Hit } | { kind: 'homebrew'; brew: Homebrew };
  const results = $derived.by((): Row[] => {
    const own: Row[] = homebrew
      .map((b) => ({ b, rank: matchRank(b.name, searched) }))
      .filter((x) => searched.trim().length >= 2 && x.rank >= 0)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 8)
      .map(({ b }) => ({ kind: 'homebrew', brew: b }));
    const found: Row[] = rows ? search(rows, searched, 40).map((hit) => ({ kind: 'entry', hit })) : [];
    return [...own, ...found];
  });
  $effect(() => {
    searched;
    at = 0;
  });

  function close() {
    open = false;
  }
  /** A phone or tablet: the result opens over the page, so the search steps aside for it. */
  const touch = () => matchMedia('(hover: none), (pointer: coarse)').matches || window.innerWidth < 640;
  function choose(r: Row | undefined, add = false) {
    if (!r) return;
    if (touch()) close();
    if (r.kind === 'homebrew') {
      onaddhomebrew?.(r.brew.id);
      return;
    }
    if (add && onadd && r.hit.kind === 'm') {
      onadd(r.hit);
      return;
    }
    const theme = themeAt(document.querySelector('.themed') ?? document.body);
    peek.open({ name: r.hit.name, url: r.hit.url, anchor: new DOMRect(), ...theme });
    // The field keeps the keyboard, so Esc, the arrows, and typing still work.
    input?.focus();
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      at = Math.max(0, Math.min(results.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)));
      queueMicrotask(() => list?.querySelector<HTMLElement>(`[data-i="${at}"]`)?.scrollIntoView({ block: 'nearest' }));
    } else if (e.key === 'Enter' && e.target === input) {
      e.preventDefault();
      settle.flush();
      choose(results[at], e.shiftKey);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  /** / opens it, wherever nothing is being typed. */
  function global(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    const typing = Boolean(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !open) {
      e.preventDefault();
      open = true;
    }
  }
  const still = prefersReducedMotion();
  function drop(_node: Element, { out = false } = {}) {
    return {
      duration: still ? 0 : out ? 140 : 220,
      easing: cubicOut,
      css: (t: number) => `opacity: ${t}; transform: translateY(${(1 - t) * (out ? -4 : -10)}px) scale(${0.98 + 0.02 * t});`
    };
  }
</script>

<svelte:window onkeydown={global} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="spotscrim" use:portal transition:fade={{ duration: still ? 0 : 180 }} use:backdrop={close}>
    <!-- Keys are heard by the whole box, so Esc still closes it after a result was pressed. -->
    <div class="spotbox" role="dialog" aria-modal="true" aria-label="Search 5e.tools" tabindex="-1" onkeydown={key}
         in:drop out:drop={{ out: true }}>
      <div class="spotfield">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8" /><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
        <input bind:this={input} bind:value={query} placeholder="Search spells, items, monsters, and more"
               aria-label="Search 5e.tools" aria-controls="spot-results" aria-activedescendant={results.length ? `spot-${at}` : undefined}
               autocomplete="off" spellcheck="false" />
        <kbd class="spotesc">Esc</kbd>
        <button type="button" class="closex spotx" aria-label="Close the search" onclick={close}>×</button>
      </div>
      {#if searched.trim().length >= 2}
        <ul class="spotlist themed-scroll" id="spot-results" role="listbox" bind:this={list}>
          {#each results as r, i (r.kind === 'homebrew' ? `h${r.brew.id}` : r.hit.url)}
            <li id="spot-{i}" data-i={i} role="option" aria-selected={i === at} class:at={i === at}
                onpointermove={() => (at = i)}>
              <!-- A mouse press opens it without taking the keyboard from the field. -->
              <button class="spotopen" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={() => choose(r)}>
                <span class="spotname">{r.kind === 'homebrew' ? r.brew.name : r.hit.name}</span>
                <span class="spotwords">
                  {#if r.kind === 'homebrew'}Your homebrew {r.brew.kind === 'npc' ? 'NPC' : 'monster'}
                  {:else}{r.hit.words}<span class="spotbook">{r.hit.source}</span>{/if}
                </span>
              </button>
              {#if r.kind === 'homebrew' || (onadd && r.hit.kind === 'm')}
                <button class="smallbtn accent spotadd" tabindex="-1" onmousedown={(e) => e.preventDefault()} onclick={() => choose(r, true)}
                        title={r.kind === 'homebrew' ? 'Add to the table' : 'Add to the table (Shift Enter)'}>Add to Table</button>
              {/if}
            </li>
          {:else}
            <li class="spotnone">{rows || failed ? (failed ? 'The library is closed right now. Try again in a moment.' : 'Nothing by that name in the books.') : 'Opening the library'}</li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>
{/if}

<style>
  .spotscrim {
    position: fixed; inset: 0; z-index: 65; display: flex; justify-content: center; align-items: flex-start;
    padding: 12vh 1rem 1rem; background: rgb(0 0 0 / 0.55); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px);
  }
  .spotbox:focus { outline: none; }
  .spotbox {
    width: min(40rem, 100%); max-height: 70vh; display: flex; flex-direction: column; overflow: hidden;
    border-radius: calc(var(--r) + 4px); border: 1px solid var(--line); background: var(--surface);
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.5), 0 2px 8px rgb(0 0 0 / 0.3);
  }
  .spotfield { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; color: var(--dim); }
  .spotfield input {
    flex: 1; min-width: 0; font: inherit; font-size: 1.125rem; color: var(--text); background: none; border: 0; outline: none;
  }
  .spotx { display: none; --x-size: 2.25rem; }
  @media (hover: none), (pointer: coarse), (max-width: 639px) {
    .spotesc { display: none; }
    .spotx { display: grid; }
  }
  kbd {
    font: inherit; font-size: 0.6875rem; color: var(--dim); padding: 0.125rem 0.375rem;
    border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--raised);
  }
  .spotlist { list-style: none; margin: 0; padding: 0.375rem; overflow-y: auto; border-top: 1px solid var(--line-soft); }
  .spotlist li { display: flex; align-items: center; gap: 0.5rem; border-radius: var(--r-sm); padding-right: 0.375rem; }
  .spotlist li.at { background: var(--a-wash); }
  .spotopen {
    flex: 1; min-width: 0; display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem;
    padding: 0.5rem 0.625rem; font: inherit; color: var(--text); text-align: left; background: none; border: 0; cursor: pointer;
  }
  .spotname { font-weight: 600; overflow-wrap: anywhere; }
  li.at .spotname { color: var(--a); }
  .spotwords { flex: none; display: inline-flex; gap: 0.5rem; font-size: 0.75rem; color: var(--dim); }
  .spotbook { color: var(--faint); font-variant: all-small-caps; letter-spacing: 0.04em; }
  .spotadd { flex: none; }
  .spotnone { margin: 0; padding: 0.875rem 1rem; color: var(--dim); font-size: 0.875rem; }
  @media (max-width: 600px) {
    .spotscrim { padding-top: 1rem; }
    .spotwords { display: none; }
  }
  /* No frost on a phone: the bars above stay sharp. */
  @media (max-width: 700px) { .spotscrim { backdrop-filter: none; -webkit-backdrop-filter: none; } }
</style>
