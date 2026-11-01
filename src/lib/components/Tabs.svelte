<script lang="ts">
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';

  let {
    tabs,
    active = $bindable(),
    children
  }: {
    tabs: string[];
    active: string;
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

<div class="tablist" role="tablist" bind:this={list}>
  {#each tabs as tab, i (tab)}
    <button
      bind:this={buttons[i]}
      role="tab"
      aria-selected={active === tab}
      class:active={active === tab}
      onclick={() => select(tab)}
    >
      {tab}
    </button>
  {/each}
  <i class="indicator" class:ready class:placed={bar.width > 0} style:transform="translateX({bar.left}px)"
     style:width="{bar.width}px" aria-hidden="true"></i>
</div>

{#key active}
  <section role="tabpanel" in:slide>
    {@render children(active)}
  </section>
{/key}

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
  .indicator {
    position: absolute; left: 0; bottom: 0; height: 2px; background: var(--a);
    border-radius: 2px; opacity: 0; pointer-events: none;
  }
  .indicator.placed { opacity: 1; }
  .indicator.ready {
    transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), width 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @media (prefers-reduced-motion: reduce) { .indicator.ready { transition: none; } }
  section { padding: 1rem 0 0; }
</style>
