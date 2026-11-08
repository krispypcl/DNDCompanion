<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';

  let {
    tabs,
    active = $bindable(),
    lit = null,
    children
  }: {
    tabs: string[];
    active: string;
    /** A tab to flare for a moment (Spells, when a slot is spent). */
    lit?: string | null;
    children: import('svelte').Snippet<[string]>;
  } = $props();

  /** Which way the content slides in: from the side of the tab you came from. */
  let direction = $state(1);
  let buttons: HTMLButtonElement[] = $state([]);
  let list: HTMLDivElement | undefined = $state();
  /** The underline is one element that travels to the chosen tab. */
  let bar = $state({ left: 0, width: 0 });
  /* Placed first without moving, then allowed to move: otherwise it would
     slide in from the left edge when the sheet opens. */
  let ready = $state(false);

  function measure() {
    const i = tabs.indexOf(active);
    const el = buttons[i];
    if (!el) return;
    bar = { left: el.offsetLeft, width: el.offsetWidth };
    if (!ready && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => (ready = true)));
    }
  }

  $effect(() => {
    active;
    measure();
  });

  $effect(() => {
    if (!list || typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(list);
    return () => watch.disconnect();
  });

  /**
   * The panel grows or shrinks to the new tab's height rather than jumping:
   * measured before the switch and after it, and eased between. Where the
   * card is stretched to its neighbours (a laptop) the two are the same and
   * nothing moves.
   */
  let panels: HTMLDivElement | undefined = $state();
  let before = 0;
  $effect.pre(() => {
    active;
    before = panels?.offsetHeight ?? 0;
  });
  $effect(() => {
    active;
    const el = panels;
    if (!el || !before || prefersReducedMotion() || typeof el.animate !== 'function') return;
    const after = el.offsetHeight;
    if (Math.abs(after - before) < 4) return;
    el.animate([{ height: `${before}px`, overflow: 'hidden' }, { height: `${after}px`, overflow: 'hidden' }], {
      duration: 280,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
    });
  });

  function slide(_node: Element) {
    const span = prefersReducedMotion() ? 0 : 260;
    const dx = 14 * direction;
    return {
      duration: span,
      easing: cubicOut,
      css: (t: number, u: number) => `opacity: ${t}; transform: translate3d(${u * dx}px, 0, 0);`
    };
  }

  function select(tab: string) {
    direction = tabs.indexOf(tab) >= tabs.indexOf(active) ? 1 : -1;
    active = tab;
    if (typeof location !== 'undefined') {
      history.replaceState(null, '', `#${tab.toLowerCase()}`);
    }
  }
</script>

<div class="tabwrap">
<div class="tablist" role="tablist" bind:this={list}>
  {#each tabs as tab, i (tab)}
    <button
      bind:this={buttons[i]}
      role="tab"
      aria-selected={active === tab}
      class:active={active === tab}
      class:lit={lit === tab}
      onclick={() => select(tab)}
    >
      {tab}
    </button>
  {/each}
  <i class="indicator" class:ready class:placed={bar.width > 0} style:transform="translateX({bar.left}px)"
     style:width="{bar.width}px" aria-hidden="true"></i>
</div>
</div>

<div class="panels" bind:this={panels} data-scrollbox>
  {#key active}
    <section role="tabpanel" in:slide>
      {@render children(active)}
    </section>
  {/key}
</div>

<style>
  .tablist {
    display: flex;
    gap: 1.25rem;
    border-bottom: 1px solid var(--line-soft);
    overflow-x: auto;
    scrollbar-width: none;
    position: relative;
  }
  .tablist::-webkit-scrollbar { display: none; }
  button {
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;
    color: var(--dim);
    font: inherit;
    font-size: 0.9rem;
    padding: 0.5rem 0 0.6875rem;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  button:hover { color: var(--text); }
  .active { color: var(--a); }
  .lit { animation: tabFlare 1.5s ease-out; }
  @keyframes tabFlare {
    18% { color: var(--a-hi); text-shadow: 0 0 12px color-mix(in oklch, var(--a) 70%, transparent); }
  }
  .indicator {
    position: absolute; left: 0; bottom: 0; height: 2px; background: var(--a);
    border-radius: 2px; opacity: 0; pointer-events: none;
  }
  .indicator.placed { opacity: 1; }
  .indicator.ready {
    transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), width 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @media (prefers-reduced-motion: reduce) { .indicator.ready { transition: none; } }
  /* Wherever the strip is too narrow for every tab (a phone, or the middle
     column of a mid-sized window), the tabs become a grid of buttons, every
     one in view, rather than a strip that hides some off its edge. */
  .tabwrap { container-type: inline-size; }
  @container (max-width: 50rem) {
    .tablist {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(4.75rem, 1fr)); gap: 0.375rem;
      border-bottom: 0; overflow: visible;
    }
    button {
      padding: 0.5rem 0.25rem; border: 1px solid var(--line-soft); border-radius: var(--r-sm);
      background: var(--raised); text-align: center; font-size: 0.8125rem;
      overflow: hidden; text-overflow: ellipsis;
      transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
    }
    .active { border-color: var(--a-edge); background: var(--a-wash); }
    .indicator { display: none; }
  }
  section { padding: 1rem 0 0; }
  /* A wide screen: the module keeps its height and scrolls within it, on a
     slim scrollbar of its own. */
  @media (min-width: 861px) {
    .panels {
      overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
      margin-right: -0.5rem; padding-right: 0.5rem; scrollbar-gutter: stable;
      scrollbar-width: thin; scrollbar-color: color-mix(in oklch, var(--text) 22%, transparent) transparent;
    }
    .panels:hover { scrollbar-color: color-mix(in oklch, var(--a) 55%, transparent) transparent; }
    .panels::-webkit-scrollbar { width: 6px; }
    .panels::-webkit-scrollbar-track { background: transparent; }
    .panels::-webkit-scrollbar-thumb { background: color-mix(in oklch, var(--text) 22%, transparent); border-radius: 6px; }
    .panels:hover::-webkit-scrollbar-thumb { background: color-mix(in oklch, var(--a) 55%, transparent); }
  }
  /* The writing tabs fill the rest of the card, so a page has the whole
     height to be written on and its page controls sit at the foot. */
  .panels { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
  section:has(:global(.book)) { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; }
</style>
