<script lang="ts">
  /**
   * A picture at the size of the screen, over a dimmed page. Pressing
   * anywhere but the picture, or Escape, closes it.
   *
   * Given the thumbnail it was opened from, it grows out of that thumbnail
   * and shrinks back into it on closing.
   */
  import { backdrop, portal } from '#lib/actions.ts';
  import { onMount, tick, untrack } from 'svelte';
  import { scale } from 'svelte/transition';
  import { fade, prefersReducedMotion } from '#lib/motion.ts';
  import { cubicOut } from 'svelte/easing';
  import { windowSounds } from '#lib/sound.ts';

  let {
    src,
    alt = '',
    from,
    onclose
  }: { src: string; alt?: string; from?: Element | null; onclose: () => void } = $props();

  let img = $state<HTMLImageElement>();
  /** The thumbnail's box, taken when the picture opens. */
  // Taken once, as it opens: the thumbnail is where it was pressed.
  const origin = untrack(() => from?.getBoundingClientRect?.() ?? null);
  const zooms = Boolean(origin && origin.width > 0);

  /** From the thumbnail's box to the picture's, as one transform. */
  function fromThumb(): Keyframe | null {
    if (!img || !origin) return null;
    const end = img.getBoundingClientRect();
    if (!end.width || !end.height) return null;
    const sx = origin.width / end.width;
    const sy = origin.height / end.height;
    const dx = origin.left + origin.width / 2 - (end.left + end.width / 2);
    const dy = origin.top + origin.height / 2 - (end.top + end.height / 2);
    return { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, borderRadius: '10px', opacity: 0.6 };
  }

  $effect(() => {
    if (ratio === null || !zooms || still) return;
    void tick().then(() => {
      const start = fromThumb();
      if (start) img?.animate([start, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)' });
    });
  });

  let closing = false;
  /** Shrinks back into the thumbnail, then closes. */
  function close() {
    if (closing) return;
    closing = true;
    const end = zooms && !still ? fromThumb() : null;
    if (!end || !img) return onclose();
    const run = img.animate([{ transform: 'none', opacity: 1 }, end], { duration: 260, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'forwards' });
    run.onfinish = () => onclose();
  }

  const still = prefersReducedMotion();
  /** The picture's own proportions, known once it has loaded. Until then it
      is not shown, so it never appears at the wrong size first. */
  let ratio = $state<number | null>(null);
  function measured(e: Event) {
    const img = e.currentTarget as HTMLImageElement;
    if (img.naturalWidth && img.naturalHeight) ratio = img.naturalWidth / img.naturalHeight;
  }
  let closer: HTMLButtonElement | undefined = $state();


  onMount(() => {
    const before = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closer?.focus();
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  });

  // Heard as it opens and as it goes.
  $effect(windowSounds);
</script>

<div
  class="lightbox"
  use:portal
  role="dialog"
  aria-modal="true"
  aria-label={alt || 'Picture'}
  tabindex="-1"
  transition:fade={{ duration: still ? 0 : 180 }}
  use:backdrop={close}
  onkeydown={() => {}}
>
  <!-- As large as the screen allows, small pictures included, at their own
       proportions: whichever of width or height runs out first decides. -->
  {#if zooms}
    <img bind:this={img} {src} {alt} onload={measured} class:ready={ratio !== null} class:zoom={true} style:--ratio={ratio ?? 1} />
  {:else}
    <img bind:this={img} {src} {alt} onload={measured} class:ready={ratio !== null} style:--ratio={ratio ?? 1}
         transition:scale={{ start: 0.94, duration: still ? 0 : 220, easing: cubicOut }} />
  {/if}
  <button bind:this={closer} class="closex close" aria-label="Close" title="Close (Esc)" onclick={close}>×</button>
</div>

<style>
  .lightbox {
    position: fixed; inset: 0; z-index: 60;
    --gap: 1.5rem;
    display: grid; place-items: center; padding: var(--gap);
    background: rgb(0 0 0 / 0.78);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    cursor: zoom-out;
  }
  img {
    /* 92% of the room left by the margin: large, with space to breathe. */
    width: calc(min(calc(100vw - var(--gap) * 2), calc((100dvh - var(--gap) * 2) * var(--ratio))) * 0.92);
    aspect-ratio: var(--ratio); height: auto; object-fit: contain;
    cursor: default; opacity: 0; transition: opacity 0.15s var(--ease-out);
    border-radius: var(--r); box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
  }
  img.ready { opacity: 1; }
  /* Growing out of its thumbnail: no fade of its own, the zoom is the entrance. */
  img.zoom { transition: none; }
  @media (max-width: 700px) { .lightbox { --gap: 0.75rem; } }
  /* The square × every window has (global .closex), in the corner. */
  .close { position: absolute; top: 0.75rem; right: 0.75rem; --x-size: 2.25rem; cursor: pointer; }
  /* No frost on a phone: the bars above stay sharp. */
  @media (max-width: 700px) { .lightbox { backdrop-filter: none; -webkit-backdrop-filter: none; } }
</style>
