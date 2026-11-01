<script lang="ts">
  /**
   * The character's banner: the whole top of the sheet, cut off along a
   * curve that sweeps down from the left. It belongs to the page rather than
   * to the window, so it scrolls away with the header it sits behind, while
   * the image inside drifts at three quarters of the page's speed.
   */
  import { onMount } from 'svelte';
  import { DESKTOP_BLUR, DESKTOP_CURVE, PHONE_BLUR, PHONE_CURVE, maskUrl } from '$lib/bannerMask';
  import { prefersReducedMotion } from '$lib/motion';

  let { url }: { url: string } = $props();

  let drift = $state(0);
  /** A link that no longer works leaves no banner rather than a tinted blank. */
  let failed = $state(false);
  $effect(() => {
    url;
    failed = false;
  });

  /* The layer's own size and whether it is the phone's, which together decide
     the shape and softness of the edge. */
  let width = $state(0);
  let height = $state(0);
  let phone = $state(false);
  const mask = $derived(
    width > 0 && height > 0
      ? maskUrl(width, height, phone ? PHONE_CURVE : DESKTOP_CURVE, phone ? PHONE_BLUR : DESKTOP_BLUR)
      : ''
  );

  onMount(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia('(max-width: 700px)');
    phone = query.matches;
    const follow = () => (phone = query.matches);
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  });

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
    <!-- One continuous sweep, falling from left to right. An earlier shape
         doubled back on itself and left a kink above the hit points. -->
    <clipPath id="banner-curve" clipPathUnits="objectBoundingBox">
      <path d="M0,0 H1 V0.70 C0.74,0.78 0.40,0.46 0,0.30 Z" />
    </clipPath>
    <!-- The same fractions read far steeper in a tall narrow box, so a phone
         gets its own, much gentler. -->
    <clipPath id="banner-curve-phone" clipPathUnits="objectBoundingBox">
      <path d="M0,0 H1 V0.46 C0.70,0.56 0.34,0.34 0,0.26 Z" />
    </clipPath>
  </defs>
</svg>

<!-- Until the layer has been measured it keeps the hard clip below; once the
     soft mask exists it takes over, so there is never an unshaped banner. -->
<div
  class="slash"
  class:feathered={mask !== ''}
  class:failed
  style:--mask={mask || undefined}
  bind:clientWidth={width}
  bind:clientHeight={height}
  aria-hidden="true"
>
  <!-- object-fit: cover crops to the layer. The image is never stretched: a
       banner of the wrong proportions loses its edges, not its shape. -->
  <img src={url} alt="" style:--drift="{drift}px" onerror={() => (failed = true)} />
  <!-- Earns its keep twice: it holds the contrast the text needs, and its
       gradients keep the curve from ending on a hard line. -->
  <div class="tint"></div>
</div>

<style>
  .slash.failed { display: none; }
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
  /* Where the mask can be used it replaces the clip: a clip would cut the
     feathering off at the very line it is meant to soften. */
  @supports (mask-image: none) or (-webkit-mask-image: none) {
    .slash.feathered {
      clip-path: none;
      -webkit-mask-image: var(--mask);
      mask-image: var(--mask);
      -webkit-mask-size: 100% 100%;
      mask-size: 100% 100%;
      -webkit-mask-repeat: no-repeat;
      mask-repeat: no-repeat;
    }
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
    .slash { height: 26rem; clip-path: url(#banner-curve-phone); }
    @supports (mask-image: none) or (-webkit-mask-image: none) {
      .slash.feathered { clip-path: none; }
    }
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
