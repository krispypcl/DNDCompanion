<!--
  A phone's pull to refresh. At the very top of the page, a finger dragging
  down pulls the page down after it (the layout moves its route by `offset`,
  with `top`, never a transform), and the app's mark turns in the gap that
  opens, growing clearer as it nears the point of release. Let go past it and
  the mark spins while the page reloads, once nothing is waiting to be saved;
  let go short of it and the page eases back up. The browser's own pull and
  bounce are switched off (overscroll-behavior), so the banner fades up into
  the gap instead of ending in a line (Banner's reach).

  Not from inside a window, a field, the table board, a box that has scrolled,
  or a card being dragged.
-->
<script lang="ts">
  import Logo from './Logo.svelte';
  import { phone } from '#lib/stores/phone.svelte.ts';

  let {
    offset = $bindable(0),
    pulling = $bindable(false),
    busy
  }: {
    /** How far the page is pulled down, in pixels. */
    offset?: number;
    /** A finger is pulling now (the page follows it without easing). */
    pulling?: boolean;
    /** Something still waits to be saved: the reload waits for it. */
    busy: () => boolean;
  } = $props();

  /** Past this, letting go refreshes; the page then rests at HOLD while it does. */
  const READY = 72;
  const HOLD = 56;
  const MAX = 120;
  let refreshing = $state(false);
  const progress = $derived(Math.min(1, offset / READY));

  const SKIP = '[data-nopull], .board, input, textarea, select, [contenteditable="true"], [role="dialog"], .held, .reordering';
  function skipped(target: EventTarget | null): boolean {
    const el = target as Element | null;
    if (!el?.closest || el.closest(SKIP) || document.querySelector('[aria-modal="true"]')) return true;
    // A box of its own that has scrolled away from its top keeps the finger.
    for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) if (e.scrollTop > 0) return true;
    return false;
  }

  function reloadWhenSaved(tries = 0) {
    if (busy() && tries < 20) return void setTimeout(() => reloadWhenSaved(tries + 1), 250);
    location.reload();
  }

  $effect(() => {
    if (!phone.current) return;
    const root = document.documentElement;
    root.classList.add('pull-refresh');
    let tracking = false;
    let startX = 0;
    let startY = 0;
    const start = (e: TouchEvent) => {
      tracking = !refreshing && e.touches.length === 1 && window.scrollY <= 0 && !skipped(e.target);
      if (!tracking) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!pulling) {
        const dy = t.clientY - startY;
        const dx = Math.abs(t.clientX - startX);
        // Not yet a pull: sideways, upward, or a card lifted for dragging lets it go.
        if (dy < -4 || dx > 12 || window.scrollY > 0 || document.querySelector('.held')) return void (tracking = false);
        if (dy < 8 || dx > dy) return;
        pulling = true;
        startY = t.clientY;
      }
      if (e.cancelable) e.preventDefault();
      // Half the finger's travel: the page resists, as a pull should.
      offset = Math.min(MAX, Math.max(0, t.clientY - startY) * 0.5);
    };
    const end = () => {
      tracking = false;
      if (!pulling) return;
      pulling = false;
      if (offset >= READY) {
        refreshing = true;
        offset = HOLD;
        reloadWhenSaved();
      } else {
        offset = 0;
      }
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', end);
    return () => {
      root.classList.remove('pull-refresh');
      window.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
    };
  });
</script>

{#if offset > 0 || refreshing}
  <div class="pullgap" class:pulling style:height="{offset}px" role={refreshing ? 'status' : undefined}>
    <span class="pullmark" class:ready={offset >= READY} class:going={refreshing}
          style:opacity={refreshing ? 1 : 0.25 + progress * 0.75} style:--turn="{offset * 4}deg" style:--size={0.6 + progress * 0.4}>
      <Logo size={28} />
    </span>
    {#if refreshing}<span class="pullword">Refreshing</span>{/if}
  </div>
{/if}

<style>
  /* The gap the pull opens at the top of the screen, the mark in its middle. */
  .pullgap {
    position: fixed; left: 0; right: 0; top: 0; z-index: 31; pointer-events: none; overflow: hidden;
    display: grid; place-items: center; padding-top: env(safe-area-inset-top, 0px); box-sizing: content-box;
    transition: height 0.28s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .pullgap.pulling { transition: none; }
  .pullmark {
    display: grid; place-items: center; color: var(--text);
    transform: rotate(var(--turn)) scale(var(--size));
    transition: color 0.2s ease;
  }
  /* Far enough: let go to refresh. */
  .pullmark.ready { color: var(--a); }
  .pullmark.going { color: var(--a); transform: none; animation: pullspin 0.9s linear infinite; }
  @keyframes pullspin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .pullmark.going { animation: none; }
    .pullgap { transition: none; }
  }
  .pullword { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
