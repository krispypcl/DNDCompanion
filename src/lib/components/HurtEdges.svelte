<script lang="ts">
  /**
   * The screen reddens at its left and right edges once the character is
   * below half health, and more the closer to zero they get. It is a mood,
   * not a meter: the hit point module is still where the number is.
   *
   * Fixed to the viewport and out of the way of every click. The edges grow
   * and fade by transition, so a heal drains it and a hit floods it rather
   * than either snapping.
   */
  import { hurtLevel } from '$lib/rules/hp';

  let { current, max }: { current: number; max: number } = $props();

  const hurt = $derived(hurtLevel(current, max));
  /** Past three quarters of the way to zero, it breathes. */
  const critical = $derived(hurt >= 0.5);
</script>

<div class="edges" style:--hurt={hurt} data-hurt={hurt.toFixed(2)} aria-hidden="true">
  <div class="edge left"><i class:critical></i></div>
  <div class="edge right"><i class:critical></i></div>
</div>

<style>
  .edges { position: fixed; inset: 0; z-index: 30; pointer-events: none; }
  .edge {
    position: absolute; top: 0; bottom: 0;
    width: clamp(4.5rem, 15vw, 15rem);
    /* Nothing at all until hurt, then a floor so the first sign is visible,
       rising to nearly full at zero. */
    opacity: calc(min(var(--hurt), 1) * 0.86 + min(var(--hurt) * 40, 1) * 0.14);
    transform: scaleX(calc(0.55 + var(--hurt) * 0.45));
    transition: opacity 0.9s ease, transform 0.9s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .left { left: 0; transform-origin: left center; }
  .right { right: 0; transform-origin: right center; }
  .edge i {
    display: block; width: 100%; height: 100%;
    background: linear-gradient(
      to right,
      color-mix(in oklch, var(--danger) 62%, transparent) 0%,
      color-mix(in oklch, var(--danger) 26%, transparent) 38%,
      color-mix(in oklch, var(--danger) 8%, transparent) 72%,
      transparent 100%
    );
  }
  .right i { transform: scaleX(-1); }
  .edge i.critical { animation: breathe 2.6s ease-in-out infinite; }
  @keyframes breathe {
    0%, 100% { opacity: 0.72; }
    50% { opacity: 1; }
  }
  @media (max-width: 700px) {
    /* A phone's edge is also its text, so the wash is narrower. */
    .edge { width: clamp(2.5rem, 11vw, 5rem); }
  }
</style>
