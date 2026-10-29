<script lang="ts">
  /**
   * The character's banner: the whole top of the sheet, cut off along a
   * curve that sweeps down from the left. It belongs to the page rather than
   * to the window, so it scrolls away with the header it sits behind, while
   * the image inside drifts at three quarters of the page's speed.
   */
  import { onMount } from 'svelte';
  import { prefersReducedMotion } from '$lib/motion';

  let { url }: { url: string } = $props();

  let drift = $state(0);

  onMount(() => {
    if (prefersReducedMotion()) return;
    let queued = false;
    const follow = () => {
      queued = false;
      /* The layer travels up with the page; holding the image down by a
         quarter of that is what makes it lag behind. Capped, because once
         the banner has scrolled past there is nothing left to lag. */
      drift = Math.min(window.scrollY * 0.25, 220);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(follow);
    };
    follow();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });
</script>

<!-- The curve is in fractions of the layer's own box, so it keeps its shape
     at any width without a media query to redraw it. -->
<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="banner-curve" clipPathUnits="objectBoundingBox">
      <path d="M0,0 H1 V0.74 C0.70,0.99 0.33,0.33 0,0.17 Z" />
    </clipPath>
  </defs>
</svg>

<div class="slash" aria-hidden="true">
  <!-- object-fit: cover crops to the layer. The image is never stretched: a
       banner of the wrong proportions loses its edges, not its shape. -->
  <img src={url} alt="" style:--drift="{drift}px" />
  <!-- Earns its keep twice: it holds the contrast the text needs, and its
       gradients keep the curve from ending on a hard line. -->
  <div class="tint"></div>
</div>

<style>
  .defs { position: absolute; width: 0; height: 0; overflow: hidden; }
  /**
   * No positioned ancestor, so this resolves against the initial containing
   * block: the full width of the page at its very top, rather than the
   * sheet's own column, which is centred and stops at 110rem. Deliberately
   * not 100vw — that counts the scrollbar's width and would put a horizontal
   * scrollbar on every bannered sheet.
   */
  .slash {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 22rem;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    clip-path: url(#banner-curve);
  }
  img {
    position: absolute;
    inset: -22% 0;
    width: 100%;
    height: 144%;
    object-fit: cover;
    /* Pushed past the frame so the photograph's own edges never show: cover
       alone can leave them in view when the image and the layer are close in
       proportion. The drift is applied before the scale, so it stays a
       quarter of the page's travel rather than a quarter times 1.14. */
    transform: translate3d(0, var(--drift, 0px), 0) scale(1.14);
    will-change: transform;
  }
  /**
   * Three gradients, each with a job.
   *
   * Down the page: holds the image back at the very top, where the name sits,
   * and softens the curve where it crosses the modules.
   *
   * Across: the name and the class line live at the left, and they are the
   * hardest text on the sheet to protect — dim grey on a mid-grey photograph
   * is unreadable at any tint that still shows the photograph. So the image
   * is held near the page colour on the left and opens up as it travels
   * right, away from the text.
   *
   * The ends: fades it out at both edges of the sheet.
   */
  .tint {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        to bottom,
        color-mix(in oklch, var(--bg) 62%, transparent) 0%,
        color-mix(in oklch, var(--bg) 54%, transparent) 20%,
        color-mix(in oklch, var(--bg) 34%, transparent) 52%,
        color-mix(in oklch, var(--bg) 30%, transparent) 88%,
        var(--bg) 100%
      ),
      linear-gradient(
        to right,
        var(--bg) 0%,
        color-mix(in oklch, var(--bg) 70%, transparent) 26%,
        color-mix(in oklch, var(--bg) 26%, transparent) 62%,
        color-mix(in oklch, var(--bg) 18%, transparent) 100%
      ),
      linear-gradient(to right, var(--bg) 0%, transparent 8%, transparent 90%, var(--bg) 100%);
  }

  /**
   * A phone is one column, so the sideways relief that protects the name on a
   * laptop has no room. The curve is shallower and the layer shorter, so the
   * image clears the header and is read through the frost of the hit points.
   */
  @media (max-width: 700px) {
    .slash { height: 26rem; }
    /* One column, so the header text runs the full width and the sideways
       relief has nowhere to put it. The tint stays even across instead. */
    .tint {
      background:
        linear-gradient(
          to bottom,
          color-mix(in oklch, var(--bg) 78%, transparent) 0%,
          color-mix(in oklch, var(--bg) 74%, transparent) 26%,
          color-mix(in oklch, var(--bg) 40%, transparent) 60%,
          color-mix(in oklch, var(--bg) 34%, transparent) 90%,
          var(--bg) 100%
        ),
        linear-gradient(to right, var(--bg) 0%, transparent 10%, transparent 90%, var(--bg) 100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    img { transform: none; }
  }
</style>
