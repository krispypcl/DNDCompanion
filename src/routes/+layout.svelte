<script lang="ts">
  import '../app.css';
  import { page, updated } from '$app/state';
  import { sheetStore } from '#lib/stores/sheet.ts';
  import { onNavigate } from '$app/navigation';
  import Splash from '#lib/components/Splash.svelte';
  import ConnectionNotice from '#lib/components/ConnectionNotice.svelte';
  import LookupPeek from '#lib/components/LookupPeek.svelte';
  import { arrive, prefersReducedMotion } from '#lib/motion.ts';
  import { profile } from '#lib/stores/profile.ts';
  import { adoptAccountPrefs } from '#lib/prefs.ts';
  import { installSettle } from '#lib/settle.ts';

  let { children } = $props();

  // Nothing that moves makes a scrollbar flash (lib/settle.ts).
  $effect(() => installSettle());

  /*
   * A new version was deployed: everyone's page reloads into it, but never
   * over something being written. It waits until nothing is typed into, no
   * change is still on its way to the database, and the reader has paused
   * for a few seconds (or straight away while the tab is out of sight).
   */
  $effect(() => {
    if (!updated.current) return;
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    const busy = () => {
      const el = document.activeElement as HTMLElement | null;
      const typing = Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
      return typing || sheetStore.hasUnsaved();
    };
    const tryReload = () => {
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        if (busy()) return tryReload();
        location.reload();
      }, document.hidden ? 0 : 4000);
    };
    const nudge = () => tryReload();
    tryReload();
    // Any input pushes the moment back; seeing the tab again checks at once.
    window.addEventListener('pointerdown', nudge, true);
    window.addEventListener('keydown', nudge, true);
    document.addEventListener('visibilitychange', nudge);
    return () => {
      clearTimeout(quietTimer);
      window.removeEventListener('pointerdown', nudge, true);
      window.removeEventListener('keydown', nudge, true);
      document.removeEventListener('visibilitychange', nudge);
    };
  });

  /* A device that has never chosen a look takes the account's on signing in. */
  let adopted: string | null = null;
  $effect(() => {
    const row = $profile;
    if (!row || adopted === row.id) return;
    adopted = row.id;
    adoptAccountPrefs(row);
  });

  /**
   * Where the browser can, the page being left fades and lifts away while the
   * new one rises in, instead of simply vanishing. Only between pages: a
   * change of hash (switching tabs on a sheet) is not a navigation away.
   */
  let arrivingTimer: ReturnType<typeof setTimeout> | undefined;
  onNavigate((navigation) => {
    if (typeof document === 'undefined') return;
    // The page arriving fades in as a whole (the {#key} below): what it
    // shows while it loads doesn't fade in a second time inside it.
    if (navigation.from?.url.pathname !== navigation.to?.url.pathname) {
      const root = document.documentElement;
      root.dataset.arriving = '';
      clearTimeout(arrivingTimer);
      arrivingTimer = setTimeout(() => delete root.dataset.arriving, 600);
    }
    if (!('startViewTransition' in document)) return;
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
<ConnectionNotice />
<LookupPeek />

<!--
  Keyed on the path, so every route change — opening a sheet, coming back to
  the list — plays the same arrival. Only the incoming view animates: running
  an exit as well would leave two copies in the document at once and the page
  would jump.
-->
{#key page.url.pathname}
  <div class="route" in:arrive={{ y: 10, duration: 260, delay: 30 }}>
    {@render children()}
  </div>
{/key}

<style>
  .route { position: relative; }
  /* The old page leaves; the new one brings its own arrival (the rise above). */
  :global(::view-transition-old(root)) {
    animation: leave-page 0.2s cubic-bezier(0.4, 0, 1, 1) both;
  }
  :global(::view-transition-new(root)) { animation: none; }
  @keyframes -global-leave-page {
    to { opacity: 0; transform: translateY(-8px) scale(0.99); }
  }
</style>
