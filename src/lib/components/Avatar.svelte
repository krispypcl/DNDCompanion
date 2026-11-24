<script lang="ts">
  /**
   * A player's picture, or their initial when there is none (or it fails).
   * The initial stays underneath until the picture has loaded, and the
   * picture fades in over it, so it never blinks empty on its way.
   */
  import { resolveImageUrl } from '#lib/rules/imageUrl.ts';
  let { url, name, size = 32 }: { url: string; name: string; size?: number } = $props();
  const src = $derived(resolveImageUrl(url).url);
  let failed = $state<string | null>(null);
  let shown = $state<string | null>(null);
  const initial = $derived((name.trim()[0] ?? '?').toUpperCase());
  /** A picture already in the browser's cache shows at once, without the fade. */
  function ready(img: HTMLImageElement) {
    if (img.complete && img.naturalWidth) {
      img.classList.add('instant');
      shown = img.getAttribute('src');
    }
  }
</script>

<span class="avatar" style:--size="{size}px" aria-hidden="true">
  <span class="initial">{initial}</span>
  {#if src && failed !== src}
    {#key src}
      <img {src} alt="" class:in={shown === src} use:ready onload={() => (shown = src)} onerror={() => (failed = src)} />
    {/key}
  {/if}
</span>

<style>
  .avatar {
    position: relative; width: var(--size); height: var(--size); border-radius: 50%; flex: none; overflow: hidden;
    display: inline-grid; place-items: center; background: var(--a-wash); border: 1px solid var(--a-edge);
  }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0; transition: opacity 0.2s cubic-bezier(0.33, 1, 0.68, 1); }
  img.in { opacity: 1; }
  img:global(.instant) { transition: none; }
  .initial { color: var(--a); font-weight: 650; font-size: calc(var(--size) * 0.42); }
  :global(html[data-motion='reduce']) img { transition: none; }
</style>
