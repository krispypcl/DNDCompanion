<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { onNavigate } from '$app/navigation';
  import Splash from '$lib/components/Splash.svelte';
  import { prefersReducedMotion, rise } from '$lib/motion';

  let { children } = $props();

  /**
   * Where the browser can, the page being left fades and lifts away while the
   * new one rises in, instead of simply vanishing. Only between pages: a
   * change of hash (switching tabs on a sheet) is not a navigation away.
   */
  onNavigate((navigation) => {
    if (typeof document === 'undefined' || !('startViewTransition' in document)) return;
    if (prefersReducedMotion()) return;
    if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
    return new Promise<void>((resolve) => {
      (document as Document & { startViewTransition: (cb: () => Promise<void>) => unknown }).startViewTransition(
        async () => {
          resolve();
          await navigation.complete;
        }
      );
    });
  });
</script>

<Splash />

<!--
  Keyed on the path, so every route change — opening a sheet, coming back to
  the list — plays the same arrival. Only the incoming view animates: running
  an exit as well would leave two copies in the document at once and the page
  would jump.
-->
{#key page.url.pathname}
  <div class="route" in:rise={{ y: 10, duration: 260, delay: 30 }}>
    {@render children()}
  </div>
{/key}

<style>
  /* The old page leaves; the new one brings its own arrival (the rise above). */
  :global(::view-transition-old(root)) {
    animation: leave-page 0.2s cubic-bezier(0.4, 0, 1, 1) both;
  }
  :global(::view-transition-new(root)) { animation: none; }
  @keyframes -global-leave-page {
    to { opacity: 0; transform: translateY(-8px) scale(0.99); }
  }
</style>
