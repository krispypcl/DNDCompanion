<!--
  A phone's bottom bar, drawn once by the layout (PhoneBar hands it a page's
  places): the page's places, an icon and a word each, the one you're in in
  the accent, and a dot on one that wants you (initiative called, your
  turn). Above it sits the place's one docked action, if it has one, under
  the thumb. Fixed to the bottom of the screen, the same on every page; the
  page keeps its height free at its foot, and what else sits at the
  screen's foot (toasts, the save word) rises above it (--foot).

  It rises into place from below the screen when a page with places
  arrives, and sinks back out of it when one without does. Between two
  pages with places it stays: the old places fade out as the new ones come
  in one after another. A docked action rises in above it and sinks away.
-->
<script lang="ts">
  import { slide as fold } from 'svelte/transition';
  import { untrack } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import type { BarSpec } from '#lib/stores/chrome.svelte.ts';
  import type { PlaceIcon } from './PhoneBar.svelte';

  let { spec }: { spec: BarSpec } = $props();

  /** Unique per bar, for the crossed swords' mask. */
  const uid = $props.id();
  let height = $state(0);
  // The page keeps the bar's height free, and what else sits at the screen's foot rises above it.
  $effect(() => {
    const root = document.documentElement;
    root.style.setProperty('--foot', `${height}px`);
    return () => root.style.removeProperty('--foot');
  });
  /** The bar arriving or leaving: from or to below the screen, its whole height. */
  function rise(_node: Element, { duration }: { duration: number }) {
    return { duration: prefersReducedMotion() ? 0 : duration, easing: cubicOut, css: (t: number, u: number) => `transform: translateY(${u * 105}%); opacity: ${0.4 + 0.6 * t};` };
  }
  /** The places of the page before, fading out where they stood (the new ones overlap them). */
  function leave(_node: Element) {
    return { duration: prefersReducedMotion() ? 0 : 140, easing: cubicOut, css: (t: number, u: number) => `opacity: ${t}; transform: translateY(${u * 4}px);` };
  }
  const dockMotion = () => ({ duration: prefersReducedMotion() ? 0 : 220, easing: cubicOut });
  /** After the first page's places, each next page's places come in one after another. */
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

<!-- One sword, point up, crossing the middle of the box at the middle of its blade; turned 45 degrees each way for a fight. -->
{#snippet sword(turn: number)}
  <g transform="rotate({turn} 12 12) translate(0 1.5)">
    <path d="M12 3.25 13.6 5.5v9.75h-3.2V5.5z" /><path d="M8.5 15.25h7M12 15.25v3.75" /><circle cx="12" cy="20.25" r="1.1" />
  </g>
{/snippet}

{#snippet glyph(icon: PlaceIcon)}
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      {#if icon === 'play' || icon === 'fight'}
        <!-- Two crossed swords. Where they cross, the one behind is hidden under the one in front
             (a mask of the front one, a little wider), so no outline shows through. -->
        <defs>
          <mask id="{uid}-x" maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="#fff" />
            <g stroke="#000" stroke-width="3.4" fill="#000">{@render sword(45)}</g>
          </mask>
        </defs>
        <g mask="url(#{uid}-x)">{@render sword(-45)}</g>{@render sword(45)}
      {:else if icon === 'abilities'}
        <path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      {:else if icon === 'spells'}
        <!-- A parchment scroll rolled shut, lying from bottom left to top right: the tight spiral of its
             near end, its far end, a rope wrapped three times round its middle, and the rope's ends, two
             hanging straight down and two sticking out to the right. -->
        <g transform="rotate(-45 12 12)">
          <path d="M3.5 8.25h16M3.5 15.75h16" /><ellipse cx="3.5" cy="12" rx="1.75" ry="3.75" /><path d="M19.5 8.25a1.75 3.75 0 0 1 0 7.5" />
          <path d="M3.7 13.1c-.6 0-.9-.55-.9-1.1 0-.7.45-1.2 1-1.2.5 0 .85.4.85.9" /><path d="M9.6 8.25l1.1 7.5M11.9 8.25l1.1 7.5M14.2 8.25l1.1 7.5" />
        </g>
        <path d="M13.9 15.4l-.5 4.4M15.3 15.3l.3 4.4M15.9 13.9l4.3-.7M16 15.1l4.1.8" />
      {:else if icon === 'search'}
        <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
      {:else if icon === 'features'}
        <path d="M12 3.5 14.4 8.4l5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />
      {:else if icon === 'gear'}
        <!-- A shield, a smaller one inside its rim. -->
        <path d="M12 3.25 19 5.75v5.75c0 4.4-2.9 7.6-7 9.25-4.1-1.65-7-4.85-7-9.25V5.75z" /><path d="M12 6.6 16 8.05v3.5c0 2.6-1.65 4.5-4 5.5-2.35-1-4-2.9-4-5.5v-3.5z" />
      {:else if icon === 'more'}
        <path d="M5 7h14M5 12h14M5 17h14" />
      {:else if icon === 'party'}
        <circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.5-3.4 2.8-5 5.5-5s5 1.6 5.5 5" /><circle cx="16.5" cy="9.5" r="2.5" /><path d="M15.5 14.2c2.6-.3 4.6 1.1 5 4.3" />
      {:else if icon === 'sight'}
        <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.75" />
      {:else if icon === 'board'}
        <rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="M7 15l3-3.5 2.5 2.5 2-2L17 15" />
      {:else if icon === 'person'}
        <circle cx="12" cy="8" r="3.5" /><path d="M5 20c.6-3.9 3.6-6 7-6s6.4 2.1 7 6" />
      {:else}
        <path d="M6 21V4M6 4h11l-2 4 2 4H6" />
      {/if}
    </g>
  </svg>
{/snippet}

<div class="phonefoot themed" style={spec.themeCss} bind:clientHeight={height} in:rise={{ duration: 320 }} out:rise={{ duration: 240 }}>
  {#if spec.dock}<div class="dock" transition:fold={dockMotion()}>{@render spec.dock()}</div>{/if}
  <div class="navcell">
  {#key spec.owner}
    <nav class="phonebar" class:swapped aria-label="Places" out:leave>
      {#each spec.places as p (p.key)}
        <button class="place" class:on={p.key === spec.active} aria-current={p.key === spec.active ? 'page' : undefined} onclick={() => spec.onchoose(p.key)}>
          <span class="ic" class:badge={p.badge}>{@render glyph(p.icon)}</span>
          <span class="lb">{p.label}</span>
        </button>
      {/each}
    </nav>
  {/key}
  </div>
</div>

<style>
  /* Through a page transition it keeps its place (view-transition-name) instead of fading and lifting with the page. */
  .phonefoot {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 40; view-transition-name: phonebar;
    padding: 0 max(0.5rem, env(safe-area-inset-right, 0px)) env(safe-area-inset-bottom, 0px) max(0.5rem, env(safe-area-inset-left, 0px));
  }
  /* Its ground on a layer of its own, nearly solid and without frost: a
     phone redrawing a blur under it on every scroll is what stutters. */
  .phonefoot::before {
    content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
    border-top: 1px solid color-mix(in oklch, var(--line) 80%, transparent);
    background: color-mix(in oklch, var(--surface) 97%, transparent);
  }
  .dock { display: flex; gap: 0.5rem; padding: 0.625rem 0.25rem 0.125rem; }
  .dock :global(> *) { flex: 1; }
  .dock :global(.smallbtn) { min-height: 2.75rem; font-size: 0.9375rem; font-weight: 600; justify-content: center; }
  /* The old places and the new share one cell, so they can cross-fade in place. */
  .navcell { display: grid; }
  .navcell > * { grid-area: 1 / 1; }
  .phonebar { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); padding: 0.125rem 0 0.1875rem; }
  /* A new page's places, one after another (the first page's come in with the bar itself). */
  .phonebar.swapped > .place { animation: placeIn 0.28s cubic-bezier(0.33, 1, 0.68, 1) backwards; }
  .phonebar.swapped > .place:nth-child(2) { animation-delay: 30ms; }
  .phonebar.swapped > .place:nth-child(3) { animation-delay: 60ms; }
  .phonebar.swapped > .place:nth-child(4) { animation-delay: 90ms; }
  .phonebar.swapped > .place:nth-child(5) { animation-delay: 120ms; }
  .phonebar.swapped > .place:nth-child(6) { animation-delay: 150ms; }
  .phonebar.swapped > .place:nth-child(7) { animation-delay: 180ms; }
  @keyframes placeIn { from { opacity: 0; transform: translateY(6px); } }
  @media (prefers-reduced-motion: reduce) { .phonebar.swapped > .place { animation: none; } }
  .place {
    display: grid; justify-items: center; align-content: center; gap: 0.125rem; min-height: 2.875rem; padding: 0.25rem 0 0.125rem;
    font: inherit; font-size: 0.65625rem; color: var(--dim); background: none; border: 0; border-radius: var(--r); cursor: pointer;
    -webkit-tap-highlight-color: transparent; transition: color 0.18s ease, transform 0.08s ease;
  }
  .place.on { color: var(--a); font-weight: 650; }
  .place:active { transform: translateY(1px); }
  .place:focus-visible { outline: 2px solid var(--a); outline-offset: -2px; }
  .ic { position: relative; display: grid; place-items: center; width: min(2.75rem, 100%); height: 1.625rem; border-radius: 999px; transition: background-color 0.2s ease; }
  .place.on .ic { background: var(--a-wash); }
  /* Something wants you there: a dot in the accent. */
  .ic.badge::after {
    content: ''; position: absolute; top: 0.0625rem; right: 0.5rem; width: 0.5rem; height: 0.5rem; border-radius: 50%;
    background: var(--a); box-shadow: 0 0 0 2px var(--surface);
  }
  .lb { line-height: 1.1; text-align: center; overflow-wrap: anywhere; }
</style>
