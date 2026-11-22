<!--
  A phone's top bar, drawn once by the layout: the page's buttons at the
  left, the app's dice in the middle, and the page's buttons ending with
  Back at the right (PhoneTop hands them over). Fixed to the top of the
  screen, the same place on every page; the page keeps its height free at
  its head (--topbar). At the top of a page it has no ground at all; only
  once the page has scrolled under it does it take a nearly solid ground
  and a line along its foot. No frost: a phone redrawing a blur on every
  scroll stutters.

  It slides down into place from above the screen when a page with a bar
  arrives, and back up out of it when one without a bar does. Moving between
  two pages with bars it stays: the old buttons fade out as the new ones
  come in one after another. Its ground, once the page scrolls under it,
  slides down into place behind the buttons.

  The dice in the middle is cut out of whatever lies behind it, made gray,
  turned over, and pushed to black or white (a backdrop filter through the
  dice's shape), so it shows dark on a light page, light on a dark one, and
  stays clear over a banner. It is drawn just over the bar, not in it: the
  bar is a layer of its own (its view transition name), and nothing inside
  it, a blend mode or a backdrop filter, can see the page behind.

  The dice does the pull to refresh's turning (stores/pull): it turns with
  the pull, takes the accent once letting go would refresh, and spins while
  the page reloads.
-->
<script lang="ts">
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
  /** The bar arriving or leaving: from or to above the screen, its whole height. */
  function slide(_node: Element, { duration }: { duration: number }) {
    return { duration: prefersReducedMotion() ? 0 : duration, easing: cubicOut, css: (t: number, u: number) => `transform: translateY(${-u * 105}%); opacity: ${0.4 + 0.6 * t};` };
  }
  /** The buttons of the page before, fading out where they stood (the new ones overlap them). */
  function leave(_node: Element) {
    return { duration: prefersReducedMotion() ? 0 : 140, easing: cubicOut, css: (t: number, u: number) => `opacity: ${t}; transform: translateY(${-u * 4}px);` };
  }
  /** After the first page's buttons, each next page's buttons come in one after another. */
  let swapped = $state(false);
  let firstOwner: symbol | null = null;
  $effect(() => {
    const owner = spec.owner;
    untrack(() => {
      if (firstOwner === null) firstOwner = owner;
      else if (owner !== firstOwner) swapped = true;
    });
  });
</script>

<div class="topbar themed" style={spec.themeCss} class:stuck bind:clientHeight={height} in:slide={{ duration: 320 }} out:slide={{ duration: 240 }}>
  {#key spec.owner}
    <div class="side" class:swapped out:leave>{@render spec.left?.()}</div>
  {/key}
  <!-- The dice's place: it is drawn by the layer below, over the bar. -->
  <span class="markgap" aria-hidden="true"></span>
  {#key spec.owner}
    <div class="side end" class:swapped out:leave>{@render spec.right?.()}</div>
  {/key}
</div>
<!-- The bar's height, the dice in its middle, coming and going with the bar. -->
<div class="markbar themed" style={spec.themeCss} style:height="{height}px" aria-hidden="true" in:slide={{ duration: 320 }} out:slide={{ duration: 240 }}>
  <span class="mark" class:pulling={pull.pulling} class:ready={pull.ready} class:going={pull.refreshing}
        style:--turn="{pull.offset * 4}deg">
    <!-- The dice in the colors behind it; in the accent instead while a pull would refresh, or does. -->
    <span class="ink"></span>
    <span class="lit"><Logo size={26} /></span>
  </span>
</div>

<style>
  .topbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 30;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem;
    padding: calc(0.75rem + env(safe-area-inset-top, 0px)) max(0.75rem, env(safe-area-inset-right, 0px))
             0.5rem max(0.75rem, env(safe-area-inset-left, 0px));
    view-transition-name: phonetop;
  }
  /* Its ground: away at the top of a page; once the page runs under it, it slides down into place
     behind the buttons, with a soft shadow under its line. */
  .topbar::before {
    content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: 0;
    transform: translateY(-100%);
    border-bottom: 1px solid color-mix(in oklab, var(--line) 80%, transparent);
    background: color-mix(in oklab, var(--bg) 96%, transparent);
    box-shadow: 0 6px 16px -10px rgb(0 0 0 / 0.5);
    transition: opacity 0.24s cubic-bezier(0.33, 1, 0.68, 1), transform 0.3s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .topbar.stuck::before { opacity: 1; transform: none; }
  /* The two sides share one cell each, so the old buttons and the new can cross-fade in place. */
  .topbar { grid-template-areas: 'l m r'; }
  .side { grid-area: l; display: flex; align-items: center; gap: 0.375rem; min-width: 0; }
  .side.end { grid-area: r; justify-content: flex-end; }
  /* A new page's buttons, one after another (the first page's come in with the bar itself). */
  .side.swapped > :global(*) { animation: topBtnIn 0.28s cubic-bezier(0.33, 1, 0.68, 1) backwards; }
  .side.swapped > :global(:nth-child(2)) { animation-delay: 40ms; }
  .side.swapped > :global(:nth-child(3)) { animation-delay: 80ms; }
  .side.swapped > :global(:nth-child(4)) { animation-delay: 120ms; }
  @keyframes topBtnIn { from { opacity: 0; transform: translateY(4px) scale(0.92); } }
  .markgap { grid-area: m; width: 26px; height: 26px; }
  .markbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 31; pointer-events: none; box-sizing: border-box;
    display: grid; place-items: center; padding: calc(0.75rem + env(safe-area-inset-top, 0px)) 0 0.5rem;
  }
  .mark {
    display: grid; place-items: center; width: 26px; height: 26px;
    transform: rotate(var(--turn)); transition: transform 0.28s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .mark > * { grid-area: 1 / 1; }
  .mark.pulling { transition: none; }
  .ink {
    width: 26px; height: 26px; transition: opacity 0.2s ease;
    -webkit-backdrop-filter: grayscale(1) invert(1) contrast(30);
    backdrop-filter: grayscale(1) invert(1) contrast(30);
    --die: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48' fill='none' stroke='%23000' stroke-linejoin='round'%3E%3Cpolygon points='24 3 43 14 43 34 24 45 5 34 5 14' stroke-width='2.4'/%3E%3Cpolygon points='24 12 34 29 14 29' stroke-width='2'/%3E%3Cpath d='M24 12 24 3M24 12 43 14M24 12 5 14M34 29 43 14M34 29 43 34M34 29 24 45M14 29 24 45M14 29 5 34M14 29 5 14' stroke-width='1.3' stroke-linecap='round' stroke-opacity='0.6'/%3E%3C/svg%3E");
    -webkit-mask: var(--die) center / contain no-repeat;
    mask: var(--die) center / contain no-repeat;
  }
  .lit { display: grid; color: var(--a); opacity: 0; transition: opacity 0.2s ease; }
  .mark.ready .lit, .mark.going .lit { opacity: 1; }
  .mark.ready .ink, .mark.going .ink { opacity: 0; }
  /* A browser without backdrop filters: the dice drawn plainly in the text color. */
  @supports not ((backdrop-filter: invert(1)) or (-webkit-backdrop-filter: invert(1))) {
    .ink { display: none; }
    .lit { opacity: 1; color: var(--text); }
    .mark.ready .lit, .mark.going .lit { color: var(--a); }
  }
  .mark.going { animation: markspin 0.9s linear infinite; }
  @keyframes markspin { from { transform: rotate(var(--turn)); } to { transform: rotate(calc(var(--turn) + 360deg)); } }
  @media (prefers-reduced-motion: reduce) {
    .mark, .topbar::before { transition: none; }
    .mark.going, .side.swapped > :global(*) { animation: none; }
  }
  /* Every button in it one square, a little bigger than a computer's, for a
     thumb. (The class in :is outweighs a component's own size.) */
  .side > :global(:is(button, a, .phonetop-btn)) { box-sizing: border-box; width: 2.25rem; height: 2.25rem; min-height: 0; padding: 0; }
</style>
