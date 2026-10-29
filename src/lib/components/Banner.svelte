<script lang="ts">
  /**
   * The character's banner, behind the whole sheet rather than as a strip at
   * the top: a diagonal band that enters below the top-left corner and leaves
   * at about the middle of the ability band's height. It shows in the gaps
   * between modules, and the modules over it frost rather than hide it.
   *
   * The layer is fixed, so the sheet slides over a stationary image, and the
   * image drifts against that slide at a quarter speed. The sheet is the
   * thing being read; the banner moves just enough to sit behind it.
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
      // A quarter of the page's travel, capped: past a screen or so of
      // scrolling the band is long gone and there is nothing left to drift.
      drift = Math.min(window.scrollY * 0.25, 260);
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

<div class="slash" aria-hidden="true">
  <!-- object-fit: cover crops the image to the band. It is never stretched:
       a banner with the wrong proportions loses its edges instead of its
       shape. -->
  <img src={url} alt="" style:--drift="{drift}px" />
  <!-- Earns its keep twice: it holds the contrast the text needs, and its
       gradient softens the band's long edges so they do not read as a cut. -->
  <div class="tint"></div>
</div>

<style>
  .slash {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
    /* Enters 36px below the top-left corner and leaves with its lower edge
       at about 272px, the middle of the ability band's height. Pixels rather
       than percentages: the band is placed against the modules near the top
       of the page, which do not move when the window gets taller. */
    clip-path: polygon(0 36px, 100% 152px, 100% 272px, 0 156px);
  }
  img {
    position: absolute;
    inset: -10% 0 -10%;
    width: 100%;
    height: 120%;
    object-fit: cover;
    transform: translate3d(0, calc(var(--drift, 0px) * -1), 0);
    will-change: transform;
  }
  /**
   * Three gradients, each with a job.
   *
   * Down the page: feathers the band's long edges, so it ends in a fade
   * rather than on a cut.
   *
   * Across: the name and the class line live at the left, and they are the
   * hardest text on the sheet to protect — dim grey on a mid-grey photograph
   * is unreadable at any tint that still shows the photograph. So the band is
   * held near the page colour on the left and opens up as it travels right,
   * away from the text and into the gaps between modules.
   *
   * The ends: fades the band out at both edges of the window.
   */
  .tint {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        to bottom,
        var(--bg) 0%,
        color-mix(in oklch, var(--bg) 58%, transparent) 30%,
        color-mix(in oklch, var(--bg) 54%, transparent) 70%,
        var(--bg) 100%
      ),
      linear-gradient(
        to right,
        var(--bg) 0%,
        color-mix(in oklch, var(--bg) 88%, transparent) 26%,
        color-mix(in oklch, var(--bg) 34%, transparent) 62%,
        color-mix(in oklch, var(--bg) 26%, transparent) 100%
      ),
      linear-gradient(to right, var(--bg) 0%, transparent 10%, transparent 88%, var(--bg) 100%);
  }

  /**
   * A phone is one column, so a band across the header would sit behind the
   * name and the class line with nowhere to escape to — the left-to-right
   * relief that saves them on a laptop has no room here. It runs below them
   * instead, across the hit points, where it is read through the frost.
   */
  @media (max-width: 700px) {
    .slash { clip-path: polygon(0 214px, 100% 292px, 100% 420px, 0 338px); }
  }

  @media (prefers-reduced-motion: reduce) {
    img { transform: none; }
  }
</style>
