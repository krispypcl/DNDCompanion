<!--
  The bottom bar on a phone: the page's places, an icon and a word each, the
  one you're in in the accent, and a dot on one that wants you (initiative
  called, your turn). Above it sits the place's one docked action, if it has
  one, under the thumb. Fixed to the bottom; the page keeps the same room
  free at its foot, so nothing hides behind it, and what else sits at the
  screen's foot (toasts, the save word) rises above it (--foot).
-->
<script lang="ts" module>
  export type PhonePlace = { key: string; label: string; icon: PlaceIcon; badge?: boolean };
  export type PlaceIcon = 'play' | 'abilities' | 'spells' | 'search' | 'gear' | 'features' | 'more' | 'party' | 'fight' | 'sight' | 'board' | 'person' | 'flag';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    places,
    active,
    onchoose,
    dock
  }: {
    places: PhonePlace[];
    active: string;
    onchoose: (key: string) => void;
    /** The place's one main action, above the bar. */
    dock?: Snippet;
  } = $props();

  let height = $state(0);
  // What else sits at the screen's foot (toasts, the save word) rises above the bar.
  $effect(() => {
    const root = document.documentElement;
    root.style.setProperty('--foot', `${height}px`);
    return () => root.style.removeProperty('--foot');
  });
</script>

<!-- One sword, point up, its guard at (0, 14.5), the blade solid so it reads at bar size: drawn twice, leaning apart, for a fight. -->
{#snippet sword(x: number, lean: number)}
  <g transform="translate({x} 0) rotate({lean} 0 14.5)">
    <path d="M0 2.25 1.55 4.5v9.25h-3.1V4.5z" fill="currentColor" stroke-width="1" /><path d="M-3.5 14.5h7M0 14.5v4.5" stroke-width="1.8" /><circle cx="0" cy="20.4" r="1.25" fill="currentColor" stroke="none" />
  </g>
{/snippet}

{#snippet glyph(icon: PlaceIcon)}
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      {#if icon === 'play' || icon === 'fight'}
        <!-- Two swords side by side, leaning apart, never crossing. -->
        {@render sword(7, -15)}{@render sword(17, 15)}
      {:else if icon === 'abilities'}
        <path d="M12 3.5l1.9 4.6 4.6 1.9-4.6 1.9L12 16.5l-1.9-4.6L5.5 10l4.6-1.9zM18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      {:else if icon === 'spells'}
        <!-- A rolled scroll: a roll at each end, the page and its lines between. -->
        <rect x="4.5" y="3.5" width="15" height="3.5" rx="1.75" /><rect x="4.5" y="17" width="15" height="3.5" rx="1.75" /><path d="M6.5 7v10M17.5 7v10M9.5 10.5h5M9.5 13.5h5" />
      {:else if icon === 'search'}
        <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
      {:else if icon === 'features'}
        <path d="M12 3.5 14.4 8.4l5.4.8-3.9 3.8.9 5.4-4.8-2.6-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z" />
      {:else if icon === 'gear'}
        <!-- A shield. -->
        <path d="M12 3.25 19 5.75v5.75c0 4.4-2.9 7.6-7 9.25-4.1-1.65-7-4.85-7-9.25V5.75z" /><path d="M12 6.5v11.25" />
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

<!-- The room the bar takes, kept free at the page's foot. -->
<div class="barroom" style:height="{height}px" aria-hidden="true"></div>
<div class="phonefoot" bind:clientHeight={height}>
  {#if dock}<div class="dock">{@render dock()}</div>{/if}
  <nav class="phonebar" aria-label="Places">
    {#each places as p (p.key)}
      <button class="place" class:on={p.key === active} aria-current={p.key === active ? 'page' : undefined} onclick={() => onchoose(p.key)}>
        <span class="ic" class:badge={p.badge}>{@render glyph(p.icon)}</span>
        <span class="lb">{p.label}</span>
      </button>
    {/each}
  </nav>
</div>

<style>
  .barroom { flex: none; }
  .phonefoot {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;
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
  .phonebar { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); padding: 0.125rem 0 0.1875rem; }
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
