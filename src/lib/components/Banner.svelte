<script lang="ts">
  /**
   * The character's banner: the whole top of the sheet, ending in a straight
   * slash that falls from left to right and fades out slowly across it. It belongs to the page rather than
   * to the window, so it scrolls away with the header it sits behind, while
   * the image inside drifts at three quarters of the page's speed.
   */
  import { onMount } from 'svelte';
  import { DESKTOP_SLASH, FALLBACK_MASK, PHONE_SLASH, slashMask } from '#lib/bannerMask.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';

  let { url }: { url: string } = $props();
  /**
   * How far the picture reaches above the top of the page, out of sight,
   * fading upward into nothing. Pulling a phone's page down (to refresh)
   * shows it, so the picture fades into the page instead of ending in a line.
   */
  const REACH = 128;

  let drift = $state(0);
  /** A link that no longer works leaves no banner rather than a tinted blank. */
  let failed = $state(false);
  $effect(() => {
    url;
    failed = false;
  });

  /* The layer's own size and whether it is the phone's, which together decide
     the angle of the slash. */
  let width = $state(0);
  let height = $state(0);
  let phone = $state(false);
  const mask = $derived(
    width > 0 && height > REACH ? slashMask(width, height - REACH, phone ? PHONE_SLASH : DESKTOP_SLASH) : FALLBACK_MASK
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

<div
  class="slash"
  class:failed
  style:--mask={mask}
  style:--reach="{REACH}px"
  bind:clientWidth={width}
  bind:clientHeight={height}
  aria-hidden="true"
>
  <!-- object-fit: cover crops to the layer. The image is never stretched: a
       banner of the wrong proportions loses its edges, not its shape. -->
  <div class="frame">
    <img src={url} alt="" style:--drift="{drift}px" onerror={() => (failed = true)} />
    <!-- Holds the contrast the text needs. -->
    <div class="tint"></div>
  </div>
</div>

<style>
  .slash.failed { display: none; }
  /**
   * No positioned ancestor, so this resolves against the initial containing
   * block: the full width of the page at its very top, rather than the
   * sheet's own column, which is centered and stops at 110rem. Deliberately
   * not 100vw — that counts the scrollbar's width and would put a horizontal
   * scrollbar on every bannered sheet.
   */
  .slash {
    position: absolute;
    top: calc(-1 * var(--reach));
    left: 0;
    right: 0;
    height: calc(27rem + var(--reach));
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    /* Two masks: the reach above the page fading in from nothing, and the slash below it. */
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000), var(--mask);
    mask-image: linear-gradient(to bottom, transparent, #000), var(--mask);
    -webkit-mask-size: 100% var(--reach), 100% calc(100% - var(--reach));
    mask-size: 100% var(--reach), 100% calc(100% - var(--reach));
    -webkit-mask-position: 0 0, 0 var(--reach);
    mask-position: 0 0, 0 var(--reach);
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
  }
  /* The banner's own box, below the reach: the picture spills up out of it into the reach. */
  .frame { position: absolute; left: 0; right: 0; top: var(--reach); bottom: 0; }
  /* The tint's top color carries on up through the reach, so the picture keeps one shade there. */
  .tint::before { content: ''; position: absolute; left: 0; right: 0; bottom: 100%; height: var(--reach); background: var(--tint-top, transparent); }
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
   * and softens the slash where it crosses the modules.
   *
   * Across: the name and the class line live at the left, and they are the
   * hardest text on the sheet to protect — dim gray on a mid-gray photograph
   * is unreadable at any tint that still shows the photograph. So the image
   * is held near the page color on the left and opens up as it travels
   * right, away from the text.
   *
   * The ends: fades it out at both edges of the sheet.
   */
  .tint {
    position: absolute;
    inset: 0;
    --tint-top: color-mix(in oklch, var(--bg) 62%, transparent);
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
   * laptop has no room. The slash is shallower, so the
   * image clears the header and is read through the frost of the hit points.
   */
  @media (max-width: 700px) {
    .slash { height: calc(28rem + var(--reach, 0px)); }
    /* One column, so the header text runs the full width and the sideways
       relief has nowhere to put it. The tint stays even across instead. */
    /* No veil at all behind the top bar (no side fades, nothing at the top), only under it,
       deepening where the name is. */
    .tint {
      --tint-top: transparent;
      background:
        linear-gradient(
          to bottom,
          transparent 0%,
          transparent 14%,
          color-mix(in oklch, var(--bg) 66%, transparent) 34%,
          color-mix(in oklch, var(--bg) 40%, transparent) 60%,
          color-mix(in oklch, var(--bg) 34%, transparent) 90%,
          var(--bg) 100%
        );
    }
  }

  /**
   * Light mode. The tint is mixed from the page color, which here is near
   * white, so the dark-mode strengths milked the picture into a haze. Here it
   * is held only where the name and class line sit (dark text reads on a
   * light ground) and open elsewhere, with the picture's own color brought
   * back up.
   */
  :global(:root[data-mode='light']) img { filter: saturate(1.2) contrast(1.08); }
  :global(:root[data-mode='light']) .tint {
    --tint-top: color-mix(in oklch, var(--bg) 26%, transparent);
    background:
      linear-gradient(
        to bottom,
        color-mix(in oklch, var(--bg) 26%, transparent) 0%,
        color-mix(in oklch, var(--bg) 16%, transparent) 22%,
        color-mix(in oklch, var(--bg) 6%, transparent) 52%,
        color-mix(in oklch, var(--bg) 6%, transparent) 86%,
        var(--bg) 100%
      ),
      linear-gradient(
        to right,
        color-mix(in oklch, var(--bg) 80%, transparent) 0%,
        color-mix(in oklch, var(--bg) 40%, transparent) 26%,
        transparent 62%,
        transparent 100%
      ),
      linear-gradient(to right, var(--bg) 0%, transparent 8%, transparent 90%, var(--bg) 100%);
  }
  @media (max-width: 700px) {
    :global(:root[data-mode='light']) .tint {
      --tint-top: transparent;
      background:
        linear-gradient(
          to bottom,
          transparent 0%,
          transparent 14%,
          color-mix(in oklch, var(--bg) 32%, transparent) 34%,
          color-mix(in oklch, var(--bg) 8%, transparent) 60%,
          color-mix(in oklch, var(--bg) 5%, transparent) 90%,
          var(--bg) 100%
        );
    }
  }

  @media (prefers-reduced-motion: reduce) {
    img { transform: none; }
  }
</style>
