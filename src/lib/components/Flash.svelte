<script lang="ts">
  /**
   * A short word at the foot of the screen: "Link copied". It lives at the
   * sheet's root, not in the header, because the header is its own stacking
   * context and anything inside it slides under the modules.
   */
  import { fly } from 'svelte/transition';
  import { prefersReducedMotion } from '$lib/motion';

  let { message }: { message: string | null } = $props();
</script>

{#if message}
  <p class="flash" role="status" transition:fly={{ y: prefersReducedMotion() ? 0 : 10, duration: prefersReducedMotion() ? 0 : 180 }}>
    {message}
  </p>
{/if}

<style>
  .flash {
    position: fixed; left: 50%; bottom: 1rem; translate: -50% 0; z-index: 40;
    margin: 0; padding: 0.5rem 0.875rem; max-width: calc(100vw - 2rem);
    background: var(--raised); color: var(--text);
    border: 1px solid var(--line); border-radius: var(--r-sm);
    font-size: 0.8125rem; box-shadow: 0 6px 24px rgb(0 0 0 / 0.28);
    pointer-events: none;
  }
  @media (max-width: 700px) { .flash { bottom: 5.25rem; } }
</style>
