<script lang="ts">
  /**
   * A tint rising from the bottom of the screen for each condition the
   * character has: pink while charmed, yellow while stunned, and whatever its
   * owner chose for one of their own.
   *
   * It shares the screen with the hurt edges rather than fighting them: it
   * sits behind the modules as they do, takes only the bottom of the screen
   * where they take the sides, and as the character is hurt its own sides
   * fade away to leave those to the red. With more than one condition, the
   * colors take turns.
   */
  import { onDestroy, onMount } from 'svelte';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import { hurtLevel } from '#lib/rules/hp.ts';
  import { lookKey, lookOf } from '#lib/rules/conditions.ts';
  import type { ConditionLook } from '#lib/types.ts';

  let {
    conditions,
    looks = {},
    current = 1,
    max = 1
  }: {
    conditions: string[];
    looks?: Record<string, ConditionLook>;
    /** Hit points, so the tint can make room for the hurt edges. */
    current?: number;
    max?: number;
  } = $props();

  const shown = $derived.by(() => {
    const seen = new Set<string>();
    const out: (ConditionLook & { key: string })[] = [];
    for (const name of conditions) {
      const k = lookKey(name);
      const look = lookOf(name, looks);
      if (!look || seen.has(k)) continue;
      seen.add(k);
      out.push({ key: k, ...look });
    }
    return out;
  });
  const hurt = $derived(hurtLevel(current, max));

  let turn = $state(0);
  const timer = setInterval(() => (turn += 1), prefersReducedMotion() ? 6000 : 3200);
  onDestroy(() => clearInterval(timer));
  const on = $derived(shown.length ? turn % shown.length : 0);

  // Arriving on a sheet that already has conditions, the tint fades up with
  // its rise instead of being there at once: lit only from the next frame.
  let arrived = $state(false);
  onMount(() => {
    const frame = requestAnimationFrame(() => (arrived = true));
    return () => cancelAnimationFrame(frame);
  });

  /** A condition removed: its tint sinks back down and fades, the way it
      rose, rather than vanishing. */
  function sink(node: Element) {
    const from = Number(getComputedStyle(node).opacity) || 0;
    return {
      duration: prefersReducedMotion() ? 0 : 700,
      css: (t: number) => {
        const e = t * t * (3 - 2 * t);
        return `opacity: ${from * e}; transform: scaleY(${0.55 + 0.45 * e}); animation: none;`;
      }
    };
  }
</script>

<div class="overlay" style:--hurt={hurt} aria-hidden="true">
  {#each shown as look, i (look.key)}
    <div class="tint {look.motion}" class:on={arrived && i === on} data-condition={look.key} style:--tint={look.color} out:sink>
      <i></i>
    </div>
  {/each}
</div>

<style>
  @property --hurt { syntax: '<number>'; inherits: true; initial-value: 0; }
  /* Behind the modules (z 1), with the hurt edges, above only the page. */
  .overlay {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    transition: --hurt 0.9s var(--ease-out);
    /* The sides give way to the hurt edges as they come in. */
    --side: calc(var(--hurt) * clamp(5rem, 18vw, 18rem));
    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 var(--side), #000 calc(100% - var(--side)), transparent 100%);
    mask-image: linear-gradient(90deg, transparent 0, #000 var(--side), #000 calc(100% - var(--side)), transparent 100%);
  }
  @media (max-width: 700px) {
    .overlay { --side: calc(var(--hurt) * clamp(2rem, 11vw, 4.5rem)); }
  }
  /* The entrance is on the wrapper and the movement on the band inside it,
     so the two never fight over one transform: the movement starts from
     exactly where the entrance ends, with no jump between them. */
  .tint { position: absolute; inset: 0; opacity: 0; transition: opacity 1.1s var(--ease-out); transform-origin: center bottom; }
  .tint.on { opacity: 1; }
  .tint { animation: rise 1s cubic-bezier(0.2, 0.8, 0.3, 1); }
  @keyframes rise { from { transform: scaleY(0.55); } }
  /* From the bottom only, high, with a long soft feather into nothing. */
  .tint i {
    position: absolute; left: 0; right: 0; bottom: 0; display: block;
    height: clamp(16rem, 62vh, 40rem);
    transform-origin: center bottom;
    will-change: transform, opacity;
    background: linear-gradient(to top,
      color-mix(in oklch, var(--tint) 58%, transparent) 0%,
      color-mix(in oklch, var(--tint) 42%, transparent) 12%,
      color-mix(in oklch, var(--tint) 28%, transparent) 28%,
      color-mix(in oklch, var(--tint) 16%, transparent) 48%,
      color-mix(in oklch, var(--tint) 7%, transparent) 70%,
      color-mix(in oklch, var(--tint) 2%, transparent) 86%,
      transparent 100%);
  }

  /* On a narrow screen the tint is lower and softer: the page shows only in
     gutters there, and a strong tint turned the whole of it one color. */
  @media (max-width: 700px) {
    .tint.on { opacity: 0.55; }
    .tint i { height: clamp(12rem, 42vh, 22rem); }
  }

  /* A light page: faded into white, the condition's own color came out a
     pale wash. Here it is deepened and stronger, so it reads as that color. */
  :global(:root[data-mode='light']) .tint i {
    --deep: color-mix(in oklab, var(--tint) 78%, oklch(30% 0 0));
    background: linear-gradient(to top,
      color-mix(in oklab, var(--deep) 72%, transparent) 0%,
      color-mix(in oklab, var(--deep) 54%, transparent) 12%,
      color-mix(in oklab, var(--deep) 36%, transparent) 28%,
      color-mix(in oklab, var(--deep) 20%, transparent) 48%,
      color-mix(in oklab, var(--deep) 9%, transparent) 70%,
      color-mix(in oklab, var(--deep) 3%, transparent) 86%,
      transparent 100%);
  }

  /* Every movement begins and ends at rest (full strength, full height). */
  .pulse i { animation: pulse 2.8s ease-in-out 1s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
  .heavy i { animation: heavy 4.5s ease-in-out 1s infinite; }
  @keyframes heavy { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.1); } }
  /* Stunned: a slow dazed swell. */
  .daze i { animation: daze 2.2s ease-in-out 1s infinite; }
  @keyframes daze { 0%, 100% { opacity: 1; transform: scaleY(1); } 50% { opacity: 0.7; transform: scaleY(0.94); } }
  .shimmer i { animation: shimmer 3.4s ease-in-out 1s infinite; }
  /* Opacity and a stretch only: an animated blur over the whole screen was
     the heaviest thing on a phone. */
  @keyframes shimmer { 0%, 100% { opacity: 1; transform: scaleY(1); } 50% { opacity: 0.5; transform: scaleY(1.06); } }
  .shiver i { animation: shiver 0.8s ease-in-out 1s infinite; }
  @keyframes shiver { 0%, 100% { transform: translateY(0); } 25% { transform: translateY(-2px); } 75% { transform: translateY(2px); } }

  @media (prefers-reduced-motion: reduce) {
    .tint i { animation: none !important; }
  }
</style>
