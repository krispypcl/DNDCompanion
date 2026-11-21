<!--
  A phone's top bar, the same on every page: buttons at the left, the app's
  dice in the middle, and buttons ending with Back at the right. It stays at
  the top of the screen from edge to edge (the page's own padding, given as
  --pad-top and --pad-side, is pulled back). Only once the page has scrolled
  under it does it take a nearly solid ground and a line along its foot;
  at the top of the page it has no ground at all. No frost: a phone
  redrawing a blur on every scroll stutters.

  The dice does the pull to refresh's turning (stores/pull): it turns with
  the pull, takes the accent once letting go would refresh, and spins while
  the page reloads. Moving between pages, the bar keeps its place
  (view-transition-name) instead of fading and lifting with the page.
-->
<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import Logo from './Logo.svelte';
  import { pull } from '#lib/stores/pull.svelte.ts';

  let { left, right }: { left?: Snippet; right?: Snippet } = $props();

  /** The page scrolled under the bar: read from the scroll itself, so it is never wrong on arrival. */
  let stuck = $state(false);
  $effect(() => {
    const read = () => (stuck = window.scrollY > 1);
    read();
    window.addEventListener('scroll', read, { passive: true });
    return () => window.removeEventListener('scroll', read);
  });
  // This bar shows the pull, so the pull draws no dice of its own.
  // (Counted without reading it, or the count would rerun this.)
  $effect(() => {
    untrack(() => (pull.hosts += 1));
    return () => untrack(() => (pull.hosts -= 1));
  });
</script>

<div class="phonetop" class:stuck>
  <div class="side">{@render left?.()}</div>
  <span class="mark" class:pulling={pull.pulling} class:ready={pull.ready} class:going={pull.refreshing}
        style:--turn="{pull.offset * 4}deg"><Logo size={26} /></span>
  <div class="side end">{@render right?.()}</div>
</div>

<style>
  .phonetop {
    position: sticky; top: 0; z-index: 30; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem;
    margin: calc(-1 * var(--pad-top, 0.75rem)) calc(-1 * var(--pad-side, 0.75rem)) 1rem;
    padding: calc(0.75rem + env(safe-area-inset-top, 0px)) max(var(--pad-side, 0.75rem), env(safe-area-inset-right, 0px))
             0.5rem max(var(--pad-side, 0.75rem), env(safe-area-inset-left, 0px));
    view-transition-name: phonetop;
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
  /* The dice: still at rest, turning with a pull (eased back when let go short), spinning while it refreshes. */
  .mark {
    display: grid; place-items: center; color: var(--text);
    transform: rotate(var(--turn)); transition: transform 0.28s cubic-bezier(0.33, 1, 0.68, 1), color 0.2s ease;
  }
  .mark.pulling { transition: color 0.2s ease; }
  .mark.ready, .mark.going { color: var(--a); }
  .mark.going { animation: markspin 0.9s linear infinite; }
  @keyframes markspin { from { transform: rotate(var(--turn)); } to { transform: rotate(calc(var(--turn) + 360deg)); } }
  @media (prefers-reduced-motion: reduce) { .mark, .phonetop::before { transition: none; } .mark.going { animation: none; } }
  /* Every button in it one square, a little bigger than a computer's, for a
     thumb. (The class in :is outweighs a component's own size.) */
  .side > :global(:is(button, a, .phonetop-btn)) { box-sizing: border-box; width: 2.25rem; height: 2.25rem; min-height: 0; padding: 0; }
</style>
