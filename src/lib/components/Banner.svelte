<script lang="ts">
  /**
   * The character's banner: the whole top of the sheet, ending in a straight
   * slash that falls from left to right and fades out slowly across it. It belongs to the page rather than
   * to the window, so it scrolls away with the header it sits behind, while
   * the image inside drifts at three quarters of the page's speed.
   */
  import { onMount } from 'svelte';
  import { DESKTOP_SLASH, FALLBACK_MASK, PHONE_SLASH, slashMask } from '$lib/bannerMask';
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
     the angle of the slash. */
  let width = $state(0);
  let height = $state(0);
  let phone = $state(false);
  const mask = $derived(
    width > 0 && height > 0 ? slashMask(width, height, phone ? PHONE_SLASH : DESKTOP_SLASH) : FALLBACK_MASK
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
  bind:clientWidth={width}
  bind:clientHeight={height}
  aria-hidden="true"
>
  <!-- object-fit: cover crops to the layer. The image is never stretched: a
       banner of the wrong proportions loses its edges, not its shape. -->
  <img src={url} alt="" style:--drift="{drift}px" onerror={() => (failed = true)} />
  <!-- Holds the contrast the text needs. -->
  <div class="tint"></div>
</div>

<style>
  .slash.failed { display: none; }
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
    height: 27rem;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    -webkit-mask-image: var(--mask);
    mask-image: var(--mask);
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
   * and softens the slash where it crosses the modules.
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
   * laptop has no room. The slash is shallower, so the
   * image clears the header and is read through the frost of the hit points.
   */
  @media (max-width: 700px) {
    .slash { height: 28rem; }
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

  /**
   * Light mode. The tint is mixed from the page colour, which here is near
   * white, so the same strengths as dark mode bleached the picture to a
   * pastel. Over a light page it is held back far less, and the picture
   * keeps a little more of its own colour and depth; the left still clears
   * for the name, which is dark text and reads on a light ground.
   */
  :global(:root[data-mode='light']) img { filter: saturate(1.12) contrast(1.06); }
  :global(:root[data-mode='light']) .tint {
    background:
      linear-gradient(
        to bottom,
        color-mix(in oklch, var(--bg) 34%, transparent) 0%,
        color-mix(in oklch, var(--bg) 26%, transparent) 20%,
        color-mix(in oklch, var(--bg) 12%, transparent) 52%,
        color-mix(in oklch, var(--bg) 10%, transparent) 88%,
        var(--bg) 100%
      ),
      linear-gradient(
        to right,
        color-mix(in oklch, var(--bg) 88%, transparent) 0%,
        color-mix(in oklch, var(--bg) 52%, transparent) 26%,
        color-mix(in oklch, var(--bg) 10%, transparent) 62%,
        transparent 100%
      ),
      linear-gradient(to right, var(--bg) 0%, transparent 6%, transparent 92%, var(--bg) 100%);
  }
  @media (max-width: 700px) {
    :global(:root[data-mode='light']) .tint {
      background:
        linear-gradient(
          to bottom,
          color-mix(in oklch, var(--bg) 58%, transparent) 0%,
          color-mix(in oklch, var(--bg) 50%, transparent) 26%,
          color-mix(in oklch, var(--bg) 18%, transparent) 60%,
          color-mix(in oklch, var(--bg) 14%, transparent) 90%,
          var(--bg) 100%
        ),
        linear-gradient(to right, var(--bg) 0%, transparent 10%, transparent 90%, var(--bg) 100%);
    }
  }

  /**
   * Light mode. The same tint in the page's near-white milked the picture into
   * a haze, so it is lighter: held only where the name and class line sit,
   * and open elsewhere, with the picture's own colour brought back up.
   */
  :global([data-mode='light']) img { filter: saturate(1.15) contrast(1.06); }
  :global([data-mode='light']) .tint {
    background:
      linear-gradient(
        to bottom,
        color-mix(in oklch, var(--bg) 40%, transparent) 0%,
        color-mix(in oklch, var(--bg) 30%, transparent) 22%,
        color-mix(in oklch, var(--bg) 14%, transparent) 52%,
        color-mix(in oklch, var(--bg) 12%, transparent) 86%,
        var(--bg) 100%
      ),
      linear-gradient(
        to right,
        color-mix(in oklch, var(--bg) 88%, transparent) 0%,
        color-mix(in oklch, var(--bg) 52%, transparent) 26%,
        color-mix(in oklch, var(--bg) 10%, transparent) 62%,
        transparent 100%
      ),
      linear-gradient(to right, var(--bg) 0%, transparent 8%, transparent 90%, var(--bg) 100%);
  }
  @media (max-width: 700px) {
    :global([data-mode='light']) .tint {
      background:
        linear-gradient(
          to bottom,
          color-mix(in oklch, var(--bg) 62%, transparent) 0%,
          color-mix(in oklch, var(--bg) 56%, transparent) 26%,
          color-mix(in oklch, var(--bg) 20%, transparent) 60%,
          color-mix(in oklch, var(--bg) 16%, transparent) 90%,
          var(--bg) 100%
        ),
        linear-gradient(to right, var(--bg) 0%, transparent 10%, transparent 90%, var(--bg) 100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    img { transform: none; }
  }
</style>
