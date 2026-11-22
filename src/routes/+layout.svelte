<script lang="ts">
  import '../app.css';
  import { page, updated } from '$app/state';
  import { sheetStore } from '#lib/stores/sheet.ts';
  import { onNavigate } from '$app/navigation';
  import Splash from '#lib/components/Splash.svelte';
  import ConnectionNotice from '#lib/components/ConnectionNotice.svelte';
  import { peek } from '#lib/stores/peek.svelte.ts';
  import type { Component } from 'svelte';
  import { arrive, prefersReducedMotion } from '#lib/motion.ts';
  import { profile } from '#lib/stores/profile.ts';
  import { adoptAccountPrefs } from '#lib/prefs.ts';
  import { installSettle } from '#lib/settle.ts';
  import PullRefresh from '#lib/components/PullRefresh.svelte';
  import { pull } from '#lib/stores/pull.svelte.ts';
  import { phone } from '#lib/stores/phone.svelte.ts';
  import { chrome, type BarSpec, type TopSpec } from '#lib/stores/chrome.svelte.ts';
  import TopBar from '#lib/components/TopBar.svelte';
  import BottomBar from '#lib/components/BottomBar.svelte';

  let { children } = $props();

  /*
   * A phone's two bars, drawn here once, outside every page (stores/chrome). Moving
   * between pages, one page takes its buttons back a moment before the next hands
   * its own over; a bar only goes once none has come back after that moment, so it
   * stays put between two pages that both have one.
   */
  let shownTop = $state.raw<TopSpec | null>(null);
  let shownBar = $state.raw<BarSpec | null>(null);
  $effect(() => {
    const next = chrome.top;
    if (next) return void (shownTop = next);
    const t = setTimeout(() => (shownTop = null), 80);
    return () => clearTimeout(t);
  });
  $effect(() => {
    const next = chrome.bar;
    if (next) return void (shownBar = next);
    const t = setTimeout(() => (shownBar = null), 80);
    return () => clearTimeout(t);
  });

  /*
   * The 5e.tools peek (and the 5e.tools reader behind it) loads on its own,
   * once the page has settled or the moment a name asks for it, so it never
   * weighs on a page's first paint.
   */
  let LookupPeek = $state<Component | null>(null);
  let peekLoading = false;
  function loadPeek() {
    if (peekLoading) return;
    peekLoading = true;
    import('#lib/components/LookupPeek.svelte').then(
      (m) => (LookupPeek = m.default),
      () => (peekLoading = false)
    );
  }
  $effect(() => {
    if (peek.target || peek.kept.length) loadPeek();
  });
  $effect(() => {
    const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500));
    const id = idle(loadPeek, { timeout: 4000 });
    return () => (window.cancelIdleCallback ?? clearTimeout)(id as number);
  });

  // Nothing that moves makes a scrollbar flash (lib/settle.ts).
  $effect(() => installSettle());

  /*
   * Looking for a new version: SvelteKit asks every minute, but a phone
   * freezes that timer while the app is out of sight, and a phone's app is
   * mostly opened for a moment and put away. So it also asks the moment the
   * page is seen again, comes back from the browser's back-forward memory,
   * or the device is back online (at most every 15 seconds).
   */
  $effect(() => {
    let last = 0;
    const ask = () => {
      if (document.hidden || updated.current || Date.now() - last < 15_000) return;
      last = Date.now();
      void updated.check();
    };
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) ask(); };
    document.addEventListener('visibilitychange', ask);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', ask);
    return () => {
      document.removeEventListener('visibilitychange', ask);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', ask);
    };
  });

  /*
   * A new version was deployed: everyone's page reloads into it, but never
   * over something being written. It waits until nothing is typed into, no
   * change is still on its way to the database, and the reader has paused
   * for a few seconds (or straight away while the tab is out of sight, or
   * the moment it is seen again, before anything has been touched).
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
    // Seen again: nothing has been touched yet, so now is the quietest moment.
    const shown = () => {
      if (document.hidden) return tryReload();
      if (busy()) return tryReload();
      clearTimeout(quietTimer);
      location.reload();
    };
    tryReload();
    // Any input pushes the moment back; seeing the tab again checks at once.
    window.addEventListener('pointerdown', nudge, true);
    window.addEventListener('keydown', nudge, true);
    document.addEventListener('visibilitychange', shown);
    return () => {
      clearTimeout(quietTimer);
      window.removeEventListener('pointerdown', nudge, true);
      window.removeEventListener('keydown', nudge, true);
      document.removeEventListener('visibilitychange', shown);
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
  /**
   * This move runs as a view transition: the page before fades out over the new one, so the new one
   * shows at once beneath it. Rising from nothing as well, the two were faint together halfway and the
   * screen dipped to its ground (the flicker). Without view transitions, the new page rises itself.
   */
  const move = { crossfading: false }; // read once, as the arriving page is made: not reactive on purpose
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
    move.crossfading = false;
    if (!('startViewTransition' in document)) return;
    if (prefersReducedMotion()) return;
    if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
    move.crossfading = true;
    // The top bar's dice draws plainly meanwhile (TopBar, html.vt-page), set before the old page is pictured.
    const root = document.documentElement;
    root.classList.add('vt-page');
    return new Promise<void>((resolve) => {
      const vt = (document as Document & { startViewTransition: (cb: () => Promise<void>) => { finished: Promise<void> } }).startViewTransition(
        async () => {
          resolve();
          await navigation.complete;
        }
      );
      vt.finished.catch(() => {}).finally(() => root.classList.remove('vt-page'));
    });
  });

  /** A quick second or third press on a button (a fold's title, a tab, a label) is more presses, not a word or line to select. */
  const PRESSABLE = 'button, summary, label, [role="button"], [role="tab"], [role="radio"], [role="option"], [role="menuitem"], [role="switch"], .smallbtn';
  function noRepeatSelect(e: MouseEvent) {
    const t = e.target as Element | null;
    // A field keeps its own double-click (a word in what's typed).
    if (e.detail > 1 && t?.closest?.(PRESSABLE) && !t.closest('input, textarea, [contenteditable="true"]')) e.preventDefault();
  }
</script>

<svelte:document onmousedowncapture={noRepeatSelect} />

<Splash />
<ConnectionNotice />
<PullRefresh busy={() => sheetStore.hasUnsaved()} />
{#if LookupPeek}<LookupPeek />{/if}

<!--
  Keyed on the path, so every route change — opening a sheet, coming back to
  the list — plays the same arrival. Only the incoming view animates: running
  an exit as well would leave two copies in the document at once and the page
  would jump.
-->
{#key page.url.pathname}
  <div class="route" class:pulling={pull.pulling} style:top="{pull.offset}px" in:arrive={{ y: 10, duration: move.crossfading ? 0 : 260, delay: move.crossfading ? 0 : 30 }}>
    {@render children()}
  </div>
{/key}

{#if phone.current && shownTop}<TopBar spec={shownTop} />{/if}
{#if phone.current && shownBar}<BottomBar spec={shownBar} />{/if}

<style>
  /* Pulled down to refresh, the page moves by top (it holds fixed parts, so never a transform)
     and eases back up when let go. */
  .route { position: relative; transition: top 0.28s cubic-bezier(0.33, 1, 0.68, 1); }
  /* A phone: the page keeps the bars' heights free at its head and foot (TopBar, BottomBar set them). */
  .route { padding-top: var(--topbar, 0px); padding-bottom: var(--foot, 0px); }
  .route.pulling { transition: none; }
  @media (prefers-reduced-motion: reduce) { .route { transition: none; } }
  /* Moving between pages in a view transition: the new page rises and fades in over the old,
     which stays as it was underneath until covered, so the screen never dips between the two
     (the route's own arrival above is skipped meanwhile, or it would fade in twice). */
  :global(::view-transition-old(root)) { animation: none; }
  :global(::view-transition-new(root)) { animation: arrive-page 0.26s cubic-bezier(0.33, 1, 0.68, 1) 30ms both; }
  /* A phone's top and bottom bars swap in place: the new one shows at once, the old one not at all. */
  :global(::view-transition-group(phonetop)), :global(::view-transition-group(phonebar)), :global(::view-transition-group(phonemark)),
  :global(::view-transition-new(phonetop)), :global(::view-transition-new(phonebar)), :global(::view-transition-new(phonemark)) { animation: none; }
  :global(::view-transition-old(phonetop)), :global(::view-transition-old(phonebar)), :global(::view-transition-old(phonemark)) { animation: none; opacity: 0; }
  @keyframes -global-arrive-page {
    from { opacity: 0; transform: translateY(10px); }
  }
</style>
