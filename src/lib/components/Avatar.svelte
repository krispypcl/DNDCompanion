<script lang="ts">
  /** A player's picture, or their initial when there is none (or it fails). */
  import { resolveImageUrl } from '$lib/rules/imageUrl';

  let { url, name, size = 32 }: { url: string; name: string; size?: number } = $props();
  const src = $derived(resolveImageUrl(url).url);
  let failed = $state<string | null>(null);
  const initial = $derived((name.trim()[0] ?? '?').toUpperCase());
</script>

<span class="avatar" style:--size="{size}px" aria-hidden="true">
  {#if src && failed !== src}
    <img {src} alt="" onerror={() => (failed = src)} />
  {:else}
    <span class="initial">{initial}</span>
  {/if}
</span>

<style>
  .avatar {
    width: var(--size); height: var(--size); border-radius: 50%; flex: none; overflow: hidden;
    display: inline-grid; place-items: center; background: var(--a-wash); border: 1px solid var(--a-edge);
  }
  img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .initial { color: var(--a); font-weight: 650; font-size: calc(var(--size) * 0.42); }
</style>
