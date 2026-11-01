<script lang="ts">
  /**
   * A picture at the size of the screen, over a dimmed page. Pressing
   * anywhere but the picture, or Escape, closes it.
   */
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { prefersReducedMotion } from '$lib/motion';

  let { src, alt = '', onclose }: { src: string; alt?: string; onclose: () => void } = $props();

  const still = prefersReducedMotion();
  let closer: HTMLButtonElement | undefined = $state();

  /** On the body, so no frosted panel or transformed parent can frame it. */
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  onMount(() => {
    const before = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onclose();
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
</script>

<div
  class="lightbox"
  use:portal
  role="dialog"
  aria-modal="true"
  aria-label={alt || 'Picture'}
  tabindex="-1"
  transition:fade={{ duration: still ? 0 : 180 }}
  onclick={(e) => { if (e.target === e.currentTarget) onclose(); }}
  onkeydown={() => {}}
>
  <img {src} {alt} transition:scale={{ start: 0.94, duration: still ? 0 : 220, easing: cubicOut }} />
  <button bind:this={closer} class="close" aria-label="Close" onclick={onclose}>
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>
</div>

<style>
  .lightbox {
    position: fixed; inset: 0; z-index: 60;
    display: grid; place-items: center; padding: 2.5rem 1rem;
    background: rgb(0 0 0 / 0.78);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    cursor: zoom-out;
  }
  img {
    max-width: 100%; max-height: 100%; object-fit: contain; cursor: default;
    border-radius: var(--r); box-shadow: 0 20px 60px rgb(0 0 0 / 0.5);
  }
  .close {
    position: absolute; top: 0.75rem; right: 0.75rem;
    width: 2.5rem; height: 2.5rem; border-radius: 50%; display: grid; place-items: center;
    background: rgb(255 255 255 / 0.12); border: 1px solid rgb(255 255 255 / 0.2); color: #fff;
    cursor: pointer; transition: background-color 0.15s ease;
  }
  .close:hover { background: rgb(255 255 255 / 0.22); }
</style>
