<script lang="ts">
  /**
   * The screen reddens at its left and right edges once the character is
   * below half health, and more the closer to zero they get. It is a mood,
   * not a meter: the hit point module is still where the number is.
   *
   * It lives behind the sheet: fixed to the viewport, beneath every module
   * and line of text, so it only ever colours the page's own background. It
   * starts faint and greyish-red and ends deep, saturated and nearly opaque,
   * and every step between is a transition rather than a jump.
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
  /* z-index 0, below the sheet's sections (which sit at 1) and above only the
     page background and banner. */
  /* Registered, so the number itself eases and the colour, width and
     opacity all follow it smoothly; a gradient alone cannot transition. */
  @property --hurt { syntax: '<number>'; inherits: true; initial-value: 0; }
  .edges {
    position: fixed; inset: 0; z-index: 0; pointer-events: none;
    transition: --hurt 0.9s ease;
  }
  .edge {
    position: absolute; top: 0; bottom: 0;
    width: clamp(5rem, 18vw, 18rem);
    /* Nothing at all until hurt, then a translucent floor so the first sign
       is visible, rising to nearly opaque at zero. */
    opacity: calc(min(var(--hurt) * 40, 1) * (0.3 + var(--hurt) * 0.68));
    transform: scaleX(calc(0.6 + var(--hurt) * 0.4));
  }
  .left { left: 0; transform-origin: left center; }
  .right { right: 0; transform-origin: right center; }
  .edge i {
    display: block; width: 100%; height: 100%;
    /* Always red, whatever the character's theme. Chroma climbs with the
       wound: a dull, almost brown red at first, a deep, darker one at the end. */
    --red: oklch(calc(40% - var(--hurt) * 4%) calc(0.05 + var(--hurt) * 0.12) 25);
    background: linear-gradient(
      to right,
      var(--red) 0%,
      color-mix(in oklch, var(--red) 55%, transparent) 34%,
      color-mix(in oklch, var(--red) 18%, transparent) 68%,
      transparent 100%
    );
  }
  .right i { transform: scaleX(-1); }
  .edge i.critical { animation: breathe 2.6s ease-in-out infinite; }
  @keyframes breathe {
    0%, 100% { opacity: 0.78; }
    50% { opacity: 1; }
  }
  @media (max-width: 700px) {
    .edge { width: clamp(2.5rem, 14vw, 6rem); }
  }
  @media (prefers-reduced-motion: reduce) {
    .edge i.critical { animation: none; }
  }
</style>
