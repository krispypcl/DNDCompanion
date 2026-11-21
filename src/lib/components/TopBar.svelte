<!--
  A phone's top bar, drawn once by the layout: the page's buttons at the
  left, the app's dice in the middle, and the page's buttons ending with
  Back at the right (PhoneTop hands them over). Fixed to the top of the
  screen, the same place on every page; the page keeps its height free at
  its head (--topbar). At the top of a page it has no ground at all; only
  once the page has scrolled under it does it take a nearly solid ground
  and a line along its foot. No frost: a phone redrawing a blur on every
  scroll stutters.

  It slides down into place when a page with a bar arrives and back up when
  one without a bar does; moving between two pages with bars, it stays, and
  only its buttons cross-fade.

  The dice does the pull to refresh's turning (stores/pull): it turns with
  the pull, takes the accent once letting go would refresh, and spins while
  the page reloads.
-->
<script lang="ts">
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { untrack } from 'svelte';
  import Logo from './Logo.svelte';
  import { pull } from '#lib/stores/pull.svelte.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import type { TopSpec } from '#lib/stores/chrome.svelte.ts';

  let { spec }: { spec: TopSpec } = $props();

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
  // The page keeps the bar's height free at its head.
  let height = $state(0);
  $effect(() => {
    const root = document.documentElement;
    root.style.setProperty('--topbar', `${height}px`);
    return () => root.style.removeProperty('--topbar');
  });
  const motion = (y: number) => ({ y, duration: prefersReducedMotion() ? 0 : 260, easing: cubicOut });
  const swap = () => ({ duration: prefersReducedMotion() ? 0 : 160, easing: cubicOut });
</script>

<div class="topbar themed" style={spec.themeCss} class:stuck bind:clientHeight={height} in:fly={motion(-16)} out:fly={motion(-16)}>
  {#key spec.owner}
    <div class="side" in:fade={swap()}>{@render spec.left?.()}</div>
  {/key}
  <span class="mark" class:pulling={pull.pulling} class:ready={pull.ready} class:going={pull.refreshing}
        style:--turn="{pull.offset * 4}deg"><Logo size={26} /></span>
  {#key spec.owner}
    <div class="side end" in:fade={swap()}>{@render spec.right?.()}</div>
  {/key}
</div>

<style>
  .topbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 30;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem;
    padding: calc(0.75rem + env(safe-area-inset-top, 0px)) max(0.75rem, env(safe-area-inset-right, 0px))
             0.5rem max(0.75rem, env(safe-area-inset-left, 0px));
    view-transition-name: phonetop;
  }
  .topbar::before {
    content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0;
    border-bottom: 1px solid color-mix(in oklab, var(--line) 80%, transparent);
    background: color-mix(in oklab, var(--bg) 96%, transparent);
    transition: opacity 0.2s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .topbar.stuck::before { opacity: 1; }
  /* The two sides share one cell each, so the old buttons and the new can cross-fade in place. */
  .topbar { grid-template-areas: 'l m r'; }
  .side { grid-area: l; display: flex; align-items: center; gap: 0.375rem; min-width: 0; }
  .side.end { grid-area: r; justify-content: flex-end; }
  .mark {
    grid-area: m; display: grid; place-items: center; color: var(--text);
    transform: rotate(var(--turn)); transition: transform 0.28s cubic-bezier(0.33, 1, 0.68, 1), color 0.2s ease;
  }
  .mark.pulling { transition: color 0.2s ease; }
  .mark.ready, .mark.going { color: var(--a); }
  .mark.going { animation: markspin 0.9s linear infinite; }
  @keyframes markspin { from { transform: rotate(var(--turn)); } to { transform: rotate(calc(var(--turn) + 360deg)); } }
  @media (prefers-reduced-motion: reduce) { .mark, .topbar::before { transition: none; } .mark.going { animation: none; } }
  /* Every button in it one square, a little bigger than a computer's, for a
     thumb. (The class in :is outweighs a component's own size.) */
  .side > :global(:is(button, a, .phonetop-btn)) { box-sizing: border-box; width: 2.25rem; height: 2.25rem; min-height: 0; padding: 0; }
</style>
