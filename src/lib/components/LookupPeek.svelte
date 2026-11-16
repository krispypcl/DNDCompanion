<!--
  The 5e.tools peek: the entry under the pointer, shown in a small window on
  the same screen, from its name down to its book and nothing else. The entry
  is read from 5e.tools' own data (rules/fiveData) and set in the app's type
  (rules/fiveRender); "Open on 5e.tools" goes to the page itself. One for the
  whole app, mounted in the layout; links open it through stores/peek.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { peek } from '$lib/stores/peek.svelte';
  import { peekTarget } from '$lib/rules/peek';
  import { findEntry } from '$lib/rules/fiveData';
  import { render, type Rendered } from '$lib/rules/fiveRender';

  /** Laptop: the window opens beside the name. Phone: a sheet from the bottom. */
  const NARROW = 640;
  const WIDTH = 400;
  const MAX_HEIGHT = 560;
  const GAP = 10;
  const EDGE = 12;

  let vw = $state(1280);
  let vh = $state(800);
  let boxHeight = $state(0);
  let box = $state<HTMLElement>();
  let scroller = $state<HTMLElement>();
  /** Made on the first peek and kept, so it can ease out as well as in. */
  let started = $state(false);

  type Shown = { state: 'loading' } | { state: 'found'; entry: Rendered } | { state: 'missing' } | { state: 'offline' };
  let shown = $state<Shown>({ state: 'loading' });
  let slow = $state(false);

  /*
   * What the window shows. On closing it keeps the last entry, its place and
   * its colours, so it fades where it stood rather than jumping to a corner
   * and emptying as it goes.
   */
  let last = $state<NonNullable<typeof peek.target> | null>(null);
  /** Moving between entries while open glides; opening anew starts in place. */
  let glide = $state(false);
  let wasOpen = false;
  $effect.pre(() => {
    const t = peek.target;
    glide = Boolean(t) && wasOpen;
    if (t) last = t;
    wasOpen = Boolean(t);
  });
  const target = $derived(peek.target ?? last);
  const open = $derived(Boolean(peek.target));
  const narrow = $derived(vw < NARROW);
  const width = $derived(narrow ? vw : Math.min(WIDTH, vw - 2 * EDGE));
  const maxHeight = $derived(narrow ? Math.min(Math.round(vh * 0.75), MAX_HEIGHT) : Math.min(MAX_HEIGHT, vh - 2 * EDGE));

  /** Beside the name if there is room, else on the side of the screen away from it. */
  const place = $derived.by(() => {
    if (!target || narrow) return { left: 0, top: null as number | null };
    const a = target.anchor;
    let left: number;
    if (a.right + GAP + width <= vw - EDGE) left = a.right + GAP;
    else if (a.left - GAP - width >= EDGE) left = a.left - GAP - width;
    else left = a.left + a.width / 2 < vw / 2 ? vw - width - EDGE : EDGE;
    const h = boxHeight || maxHeight;
    const top = Math.min(Math.max(a.top - 24, EDGE), vh - h - EDGE);
    return { left: Math.round(left), top: Math.round(top) };
  });

  // Look the entry up whenever the link changes; an answer for a link no
  // longer shown is dropped.
  let asked = '';
  $effect(() => {
    const t = target;
    if (!t) return;
    started = true;
    if (t.url === asked) return;
    asked = t.url;
    const where = peekTarget(t.url);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      shown = { state: 'offline' };
      return;
    }
    shown = { state: 'loading' };
    slow = false;
    const slowTimer = setTimeout(() => (slow = true), 6000);
    (where ? findEntry(where, t.name) : Promise.resolve(null))
      .then((found) => {
        if (asked !== t.url) return;
        shown = found ? { state: 'found', entry: render(found) } : { state: 'missing' };
        scroller?.scrollTo({ top: 0 });
      })
      .catch(() => {
        if (asked === t.url) shown = { state: navigator.onLine === false ? 'offline' : 'missing' };
      })
      .finally(() => clearTimeout(slowTimer));
  });

  onMount(() => {
    const size = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
    };
    size();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && peek.target) {
        e.stopPropagation();
        peek.close();
      }
    };
    // A page scrolled away from the name takes a hover peek with it; one kept
    // open, opened by a tap or with the pointer on it stays.
    const scrolled = (e: Event) => {
      if (box?.contains(e.target as Node)) return;
      if (peek.target && !peek.pinned && !peek.tapped && !peek.inside) peek.close();
    };
    // A tap outside closes a tapped peek (except on another link, which swaps it).
    const down = (e: PointerEvent) => {
      if (!peek.target || peek.pinned) return;
      const t = e.target as Element | null;
      if (box?.contains(t) || t?.closest?.('.lookup')) return;
      if (peek.tapped) peek.close();
    };
    window.addEventListener('resize', size);
    window.addEventListener('keydown', key, true);
    window.addEventListener('scroll', scrolled, { passive: true, capture: true });
    window.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('resize', size);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', scrolled, true);
      window.removeEventListener('pointerdown', down, true);
    };
  });
</script>

{#if started}
  <div
    bind:this={box}
    bind:offsetHeight={boxHeight}
    class="lookup-peek themed"
    class:open
    class:glide
    class:narrow
    role="dialog"
    aria-label={target ? `${target.name} on 5e.tools` : '5e.tools'}
    aria-hidden={!open}
    inert={!open}
    style:--h={target?.hue}
    style:--c={target?.chroma}
    style:left="{place.left}px"
    style:top={place.top === null ? null : `${place.top}px`}
    style:bottom={place.top === null ? '0px' : null}
    style:width="{width}px"
    style:max-height="{maxHeight}px"
    onpointerenter={(e) => e.pointerType !== 'touch' && peek.enter()}
    onpointerleave={(e) => e.pointerType !== 'touch' && peek.leave()}
  >
    <header>
      <h3 class="peek-name">
        {#if shown.state === 'found'}{@html shown.entry.name}{:else}{target?.name ?? ''}{/if}
      </h3>
      <div class="peek-tools">
        <button
          type="button"
          class="peek-pin"
          class:on={peek.pinned}
          aria-pressed={peek.pinned}
          aria-label={peek.pinned ? 'Kept open' : 'Keep open'}
          title={peek.pinned ? 'Kept open: hover another name to swap it' : 'Keep it open while you look at others'}
          onclick={() => (peek.pinned = !peek.pinned)}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
            <path d="M6 2h4l-.6 4 2.6 2.4V10H4V8.4L6.6 6 6 2Zm2 8v4" fill={peek.pinned ? 'currentColor' : 'none'}
                  stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
        </button>
        <a class="smallbtn quiet" href={target?.url} target="_blank" rel="noopener noreferrer">Open on 5e.tools</a>
        <button type="button" class="closex" aria-label="Close" onclick={() => peek.close()}>×</button>
      </div>
    </header>

    <div class="peek-body" bind:this={scroller}>
      {#if shown.state === 'found'}
        {@const e = shown.entry}
        {#key e}
          <div class="peek-entry">
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
  </div>
{/if}

<style>
  .lookup-peek {
    position: fixed;
    z-index: 70;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r);
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.3);
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    transform: translateY(6px) scale(0.985);
    transform-origin: 50% 0;
    /* Out: a quick fade with a slight drop, then hidden once it is gone. */
    transition:
      opacity 0.16s ease-out,
      transform 0.18s ease-out,
      visibility 0s linear 0.18s;
  }
  /* From one entry to the next while open, the window glides to its new place. */
  .lookup-peek.open.glide {
    transition:
      opacity 0.16s ease-out,
      transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0s,
      left 0.22s cubic-bezier(0.22, 1, 0.36, 1),
      top 0.22s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .lookup-peek.open {
    opacity: 1;
    visibility: visible;
    transform: none;
    transition:
      opacity 0.16s ease-out,
      transform 0.2s cubic-bezier(0.22, 1, 0.36, 1),
      visibility 0s;
  }
  /* A phone: a sheet risen from the bottom edge, as wide as the screen. */
  .lookup-peek.narrow {
    border-radius: var(--r) var(--r) 0 0;
    border-bottom: 0;
    transform: translateY(24px);
    transform-origin: 50% 100%;
  }
  .lookup-peek.narrow.open { transform: none; }
  :global([data-mode='light']) .lookup-peek {
    box-shadow: 0 18px 44px rgb(20 20 40 / 0.16), 0 2px 6px rgb(20 20 40 / 0.08);
  }

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
  .peek-pin {
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
    transition: border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }
  .peek-pin:hover, .peek-pin.on { border-color: var(--a-edge); color: var(--a); }
  .peek-pin:active { transform: translateY(1px); }
  .peek-pin:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }

  /* Only the entry scrolls, from its first line to its book. */
  .peek-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.75rem 0.875rem 0.875rem;
  }
  .peek-entry { animation: peek-in 0.22s ease-out; }
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
  .peek-text :global(.five-centre) { text-align: center; }
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
  @media (prefers-reduced-motion: reduce) {
    .lookup-peek { transition: none; }
    .peek-wait.breathe, .peek-entry { animation: none; }
  }
</style>
