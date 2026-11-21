<!--
  A phone's top bar, the same on every page: buttons at the left, the app's
  mark in the middle, and buttons ending with Back at the right. It stays at
  the top of the screen from edge to edge (the page's own padding, given as
  --pad-top and --pad-side, is pulled back), and once the page runs under it
  it takes a nearly solid ground and a line along its foot. No frost: a phone
  redrawing a blur on every scroll stutters.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Logo from './Logo.svelte';

  let { left, right }: { left?: Snippet; right?: Snippet } = $props();

  /** The page scrolled under the bar (a mark just above it says when). */
  let stuck = $state(false);
  let mark = $state<HTMLElement>();
  $effect(() => {
    if (!mark || typeof IntersectionObserver === 'undefined') return;
    const watch = new IntersectionObserver(([e]) => (stuck = !e.isIntersecting));
    watch.observe(mark);
    return () => watch.disconnect();
  });
</script>

<div class="topmark" bind:this={mark} aria-hidden="true"></div>
<div class="phonetop" class:stuck>
  <div class="side">{@render left?.()}</div>
  <span class="mark"><Logo size={26} /></span>
  <div class="side end">{@render right?.()}</div>
</div>

<style>
  .topmark { height: 0; }
  .phonetop {
    position: sticky; top: 0; z-index: 30; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem;
    margin: calc(-1 * var(--pad-top, 0.75rem)) calc(-1 * var(--pad-side, 0.75rem)) 1rem;
    padding: calc(0.75rem + env(safe-area-inset-top, 0px)) max(var(--pad-side, 0.75rem), env(safe-area-inset-right, 0px))
             0.5rem max(var(--pad-side, 0.75rem), env(safe-area-inset-left, 0px));
  }
  .phonetop::before {
    content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0;
    border-bottom: 1px solid color-mix(in oklab, var(--line) 80%, transparent);
    background: color-mix(in oklab, var(--bg) 96%, transparent);
    transition: opacity 0.2s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .phonetop.stuck::before { opacity: 1; }
  .side { display: flex; align-items: center; gap: 0.375rem; min-width: 0; }
  .side.end { justify-content: flex-end; }
  .mark { display: grid; place-items: center; color: var(--text); }
  /* Every button in it one square, a little bigger than a computer's, for a
     thumb. (The class in :is outweighs a component's own size.) */
  .side > :global(:is(button, a, .phonetop-btn)) { box-sizing: border-box; width: 2.25rem; height: 2.25rem; min-height: 0; padding: 0; }
</style>
