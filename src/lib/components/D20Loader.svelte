<script lang="ts">
  /**
   * The loading throbber: a d20 tumbling through its faces for as long as
   * something is loading, and landing when it is done — on a natural 20 when
   * it worked, a natural 1 when it did not. `onlanded` is called once the
   * result has been shown long enough to read.
   */
  import { onMount } from 'svelte';
  import { prefersReducedMotion } from '$lib/motion';

  let {
    result = null,
    label = 'Loading',
    size = 72,
    onlanded
  }: {
    /** null while loading; 20 for success, 1 for failure. */
    result?: 20 | 1 | null;
    label?: string;
    size?: number;
    onlanded?: () => void;
  } = $props();

  let face = $state(1 + Math.floor(Math.random() * 19));
  let spinner: ReturnType<typeof setInterval> | undefined;
  let landedTimer: ReturnType<typeof setTimeout> | undefined;
  const still = prefersReducedMotion();

  onMount(() => {
    if (!still) {
      spinner = setInterval(() => {
        // Any face but the one showing, and never the landing ones early.
        let next = face;
        while (next === face) next = 2 + Math.floor(Math.random() * 18);
        face = next;
      }, 110);
    }
    return () => {
      clearInterval(spinner);
      clearTimeout(landedTimer);
    };
  });

  $effect(() => {
    if (result === null) return;
    clearInterval(spinner);
    face = result;
    clearTimeout(landedTimer);
    landedTimer = setTimeout(() => onlanded?.(), still ? 0 : 650);
  });
</script>

<div class="loader" class:landed={result !== null} class:crit={result === 20} class:fumble={result === 1}
     role="status" aria-live="polite" aria-label={result === null ? label : result === 20 ? 'Loaded' : 'Could not load'}>
  <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
    <g class="die">
      <polygon class="body" points="24 3 43 14 43 34 24 45 5 34 5 14" />
      <g class="edges">
        <polygon points="24 12 34 29 14 29" />
        <path d="M24 12 24 3M24 12 43 14M24 12 5 14M34 29 43 14M34 29 43 34M34 29 24 45M14 29 24 45M14 29 5 34M14 29 5 14" />
      </g>
      <text x="24" y="25.4" text-anchor="middle" dominant-baseline="middle">{face}</text>
    </g>
  </svg>
</div>

<style>
  .loader { display: grid; place-items: center; color: var(--dim); }
  .die { transform-origin: 24px 24px; animation: tumble 0.9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite; }
  @keyframes tumble {
    0% { transform: rotate(0deg) scale(1); }
    25% { transform: rotate(80deg) scale(0.92); }
    50% { transform: rotate(180deg) scale(1); }
    75% { transform: rotate(260deg) scale(0.92); }
    100% { transform: rotate(360deg) scale(1); }
  }
  .body { fill: color-mix(in oklch, currentColor 8%, transparent); stroke: currentColor; stroke-width: 1.5; stroke-linejoin: round; }
  .edges { fill: none; stroke: currentColor; stroke-width: 0.9; stroke-linejoin: round; opacity: 0.55; }
  text { fill: var(--text); font-size: 9px; font-weight: 750; font-variant-numeric: tabular-nums; }
  /* Landing: the spin settles upright, then the face lights up. */
  .landed .die { animation: land 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.3); }
  @keyframes land {
    from { transform: rotate(-120deg) scale(0.85); }
    to { transform: rotate(0deg) scale(1); }
  }
  .crit { color: oklch(84% 0.15 90); }
  .crit .body { fill: color-mix(in oklch, currentColor 18%, transparent); }
  .crit text { fill: oklch(88% 0.15 90); }
  .crit svg { animation: glow 0.65s ease-out; }
  @keyframes glow {
    0% { filter: drop-shadow(0 0 0 transparent); }
    40% { filter: drop-shadow(0 0 14px oklch(84% 0.15 90 / 0.8)); }
    100% { filter: drop-shadow(0 0 4px oklch(84% 0.15 90 / 0.3)); }
  }
  .fumble { color: var(--danger); }
  .fumble text { fill: var(--danger); }
  :global([data-mode='light']) .crit { color: oklch(68% 0.16 80); }
  :global([data-mode='light']) .crit text { fill: oklch(55% 0.15 75); }
</style>
