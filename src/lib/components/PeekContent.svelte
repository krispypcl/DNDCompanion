<!--
  What a 5e.tools peek shows: the entry's name with the window's buttons
  beside it, then the entry from its first line to its book. Read from
  5e.tools' own data (rules/fiveData) and set in the app's type
  (rules/fiveRender). The live peek and every peek moved aside share it.
-->
<script lang="ts" module>
  import type { Rendered } from '#lib/rules/fiveRender.ts';
  type Shown = { state: 'loading' } | { state: 'found'; entry: Rendered } | { state: 'missing' } | { state: 'offline' };
  /** Entries already looked up this visit: a peek moved aside, or opened again, shows at once. */
  const seen = new Map<string, Shown>();
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { peekTarget } from '#lib/rules/peek.ts';
  import { findEntry } from '#lib/rules/fiveData.ts';
  import { render } from '#lib/rules/fiveRender.ts';

  let { name, url, tools }: { name: string; url: string; tools: Snippet } = $props();

  // svelte-ignore state_referenced_locally
  let shown = $state<Shown>(seen.get(url) ?? { state: 'loading' });
  /** Fades in only when it arrives after a wait; one already known is simply there. */
  let arrived = $state(false);
  let slow = $state(false);
  let scroller = $state<HTMLElement>();

  // Look the entry up whenever the link changes; an answer for a link no
  // longer shown is dropped.
  let asked = '';
  $effect(() => {
    const u = url;
    const n = name;
    if (u === asked) return;
    asked = u;
    const known = seen.get(u);
    if (known) {
      shown = known;
      arrived = false;
      return;
    }
    const where = peekTarget(u);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      shown = { state: 'offline' };
      return;
    }
    shown = { state: 'loading' };
    slow = false;
    const slowTimer = setTimeout(() => (slow = true), 6000);
    (where ? findEntry(where, n) : Promise.resolve(null))
      .then((found) => {
        if (asked !== u) return;
        shown = found ? { state: 'found', entry: render(found) } : { state: 'missing' };
        seen.set(u, shown);
        arrived = true;
        scroller?.scrollTo({ top: 0 });
      })
      .catch(() => {
        if (asked === u) shown = { state: navigator.onLine === false ? 'offline' : 'missing' };
      })
      .finally(() => clearTimeout(slowTimer));
  });
</script>

<header>
  <h3 class="peek-name">
    {#if shown.state === 'found'}{@html shown.entry.name}{:else}{name}{/if}
  </h3>
  <div class="peek-tools">{@render tools()}</div>
</header>

<div class="peek-body themed-scroll" bind:this={scroller}>
  {#if shown.state === 'found'}
    {@const e = shown.entry}
    {#key e}
      <div class="peek-entry" class:arrived>
        {#if e.kind}<p class="peek-kind">{@html e.kind}</p>{/if}
        {#if e.facts.length}
          <dl class="peek-facts">
            {#each e.facts as [label, value] (label)}
              <div><dt>{@html label}</dt><dd>{@html value}</dd></div>
            {/each}
          </dl>
        {/if}
        <div class="peek-text">{@html e.html}</div>
        {#if e.source}<p class="peek-source">{@html e.source}</p>{/if}
      </div>
    {/key}
  {:else}
    <p class="peek-wait" class:breathe={shown.state === 'loading'} role="status">
      {#if shown.state === 'offline'}
        The library is closed while you're offline.
      {:else if shown.state === 'missing'}
        This one isn't in 5e.tools' books under that name. Open on 5e.tools searches for it.
      {:else if slow}
        Still thumbing through the tomes. 5e.tools' books are big ones.
      {:else}
        Thumbing through the tomes
      {/if}
    </p>
  {/if}
</div>

<style>
  /* The entry's name heads the window, with the window's own buttons beside it. */
  header {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem 0.625rem 0.625rem 0.875rem;
    border-bottom: 1px solid var(--line-soft);
  }
  .peek-name {
    flex: 1;
    min-width: 0;
    margin: 0.125rem 0 0;
    font-size: 1.0625rem;
    font-weight: 650;
    line-height: 1.3;
    color: var(--a);
    overflow-wrap: anywhere;
  }
  .peek-tools {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    --x-size: 1.75rem;
  }
  /* The pin, in whichever window's buttons it sits (the open peek's or a kept one's). */
  .peek-tools :global(.peek-pin) {
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    padding: 0;
    color: var(--dim);
    cursor: pointer;
    background: none;
    border: 1px solid var(--line-soft);
    border-radius: var(--r-sm);
    transition: border-color 0.15s var(--ease-out), color 0.15s var(--ease-out), transform 0.1s var(--ease-out);
  }
  .peek-tools :global(.peek-pin):hover, .peek-tools :global(.peek-pin.on) { border-color: var(--a-edge); color: var(--a); }
  .peek-tools :global(.peek-pin):active { transform: translateY(1px); }
  .peek-tools :global(.peek-pin):focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  /* Only the entry scrolls, from its first line to its book, on a slim
     scrollbar in the character's color. */
  .peek-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.75rem 0.875rem 0.875rem;
  }
  .peek-entry.arrived { animation: peek-in 0.22s ease-out; }
  @keyframes peek-in { from { opacity: 0; } }

  .peek-kind { margin: 0 0 0.625rem; font-size: 0.8125rem; font-style: italic; color: var(--dim); }
  .peek-facts { margin: 0 0 0.75rem; display: grid; gap: 0.25rem; font-size: 0.8125rem; }
  .peek-facts div { display: grid; grid-template-columns: 7.5rem 1fr; gap: 0.5rem; }
  .peek-facts dt { color: var(--label); font-weight: 600; }
  .peek-facts dd { margin: 0; color: var(--text); }

  .peek-text { font-size: 0.8125rem; line-height: 1.55; color: var(--text); }
  .peek-text :global(p) { margin: 0 0 0.5rem; }
  .peek-text :global(h4) { margin: 0.875rem 0 0.375rem; font-size: 0.875rem; font-weight: 650; color: var(--a); }
  .peek-text :global(h5) { margin: 0.75rem 0 0.25rem; font-size: 0.8125rem; font-weight: 650; color: var(--label); }
  .peek-text :global(.five-level) { font-weight: 500; color: var(--dim); }
  .peek-text :global(ul) { margin: 0 0 0.5rem; padding-left: 1.125rem; }
  .peek-text :global(li) { margin-bottom: 0.25rem; }
  .peek-text :global(.five-note) { color: var(--dim); font-style: italic; }
  .peek-text :global(.five-ref) { margin: 0 0 0.375rem; color: var(--dim); font-size: 0.75rem; }
  .peek-text :global(.five-center) { text-align: center; }
  .peek-text :global(blockquote) { margin: 0 0 0.5rem; padding-left: 0.75rem; border-left: 2px solid var(--line); color: var(--dim); }
  .peek-text :global(.five-inset) {
    margin: 0.5rem 0; padding: 0.5rem 0.75rem; border: 1px solid var(--line-soft); border-radius: var(--r-sm); background: var(--raised);
  }
  .peek-text :global(.five-table) { margin: 0.25rem 0 0.75rem; overflow-x: auto; }
  .peek-text :global(.five-cap) { margin: 0 0 0.25rem; font-weight: 600; }
  .peek-text :global(table) { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  .peek-text :global(th) { text-align: left; font-weight: 600; color: var(--label); padding: 0.25rem 0.375rem; border-bottom: 1px solid var(--line); }
  .peek-text :global(td) { padding: 0.25rem 0.375rem; vertical-align: top; }
  .peek-text :global(tbody tr:nth-child(odd)) { background: var(--raised); }
  .peek-text :global(hr) { border: 0; border-top: 1px solid var(--line-soft); margin: 0.75rem 0; }

  /* The book is the end of the entry. */
  .peek-source {
    margin: 0.75rem 0 0;
    padding-top: 0.5rem;
    border-top: 1px solid var(--line-soft);
    font-size: 0.75rem;
    color: var(--dim);
  }

  .peek-wait { margin: 0.5rem 0; font-size: 0.8125rem; color: var(--dim); }
  .peek-wait.breathe { animation: peek-breathe 1.6s ease-in-out infinite alternate; }
  @keyframes peek-breathe {
    from { opacity: 0.55; }
    to { opacity: 1; }
  }
  :global(html[data-motion='reduce']) .peek-wait.breathe, :global(html[data-motion='reduce']) .peek-entry { animation: none; }
</style>
