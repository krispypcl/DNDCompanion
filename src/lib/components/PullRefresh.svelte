<!--
  A phone's pull to refresh. At the very top of the page, a finger dragging
  down pulls the page down after it (the layout moves its route by
  pull.offset, with `top`, never a transform). The dice in the middle of the
  top bar (PhoneTop) turns with the pull and takes the accent once letting go
  would refresh; a page without a top bar shows its own dice in the gap. Let
  go past that point and the dice spins, the page fades out under the bar,
  and it reloads once nothing is waiting to be saved; let go short of it and
  the page eases back up. The browser's own pull and bounce are off
  (overscroll-behavior), and the banner fades up into the gap (Banner's
  reach) instead of ending in a line.

  Not from inside a window, a field, the table board, a box that has
  scrolled, or a card being dragged.

  Felt too, where the phone can buzz (not iPhones, whose browsers have no
  vibration): a tick as the pull passes the point where letting go refreshes
  (a lighter one going back under it), and a firmer one as it refreshes.
-->
<script lang="ts">
  import Logo from './Logo.svelte';
  import { phone } from '#lib/stores/phone.svelte.ts';
  import { pull } from '#lib/stores/pull.svelte.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import { page } from '$app/state';
  import { feel } from '#lib/haptics.ts';

  let { busy }: { /** Something still waits to be saved: the reload waits for it. */ busy: () => boolean } = $props();

  /** Past this, letting go refreshes; the page then rests at HOLD while it does. */
  const READY = 72;
  const HOLD = 56;
  const MAX = 120;
  /** The page fading out before it reloads. */
  let leaving = $state(false);

  /** Pages with nothing live to refresh: signing in, signing up, a new password, joining, and the policy. */
  const STILL = /\/(login|signup|reset|join|privacy)\/?$/;
  const off = $derived(STILL.test(page.url.pathname));

  const SKIP = '[data-nopull], .board, input, textarea, select, [contenteditable="true"], [role="dialog"], .held, .reordering';
  function skipped(target: EventTarget | null): boolean {
    const el = target as Element | null;
    if (!el?.closest || el.closest(SKIP) || document.querySelector('[aria-modal="true"]')) return true;
    // A box of its own that has scrolled away from its top keeps the finger.
    for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) if (e.scrollTop > 0) return true;
    return false;
  }

  /** The dice spins a moment, the page fades out under the bar, then the page reloads (once saved). */
  function refresh() {
    feel('refresh');
    pull.refreshing = true;
    pull.offset = HOLD;
    const calm = prefersReducedMotion();
    setTimeout(() => (leaving = true), calm ? 0 : 450);
    setTimeout(() => reloadWhenSaved(), calm ? 0 : 450 + 300);
  }
  function reloadWhenSaved(tries = 0) {
    if (busy() && tries < 20) return void setTimeout(() => reloadWhenSaved(tries + 1), 250);
    location.reload();
  }

  $effect(() => {
    if (!phone.current || off) return;
    const root = document.documentElement;
    root.classList.add('pull-refresh');
    let tracking = false;
    let startX = 0;
    let startY = 0;
    const start = (e: TouchEvent) => {
      tracking = !pull.refreshing && e.touches.length === 1 && window.scrollY <= 0 && !skipped(e.target);
      if (!tracking) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      if (!pull.pulling) {
        const dy = t.clientY - startY;
        const dx = Math.abs(t.clientX - startX);
        // Not yet a pull: sideways, upward, or a card lifted for dragging lets it go.
        if (dy < -4 || dx > 12 || window.scrollY > 0 || document.querySelector('.held')) return void (tracking = false);
        if (dy < 8 || dx > dy) return;
        pull.pulling = true;
        startY = t.clientY;
      }
      if (e.cancelable) e.preventDefault();
      // Half the finger's travel: the page resists, as a pull should.
      pull.offset = Math.min(MAX, Math.max(0, t.clientY - startY) * 0.5);
      const ready = pull.offset >= READY;
      if (ready !== pull.ready) feel(ready ? 'tick' : 'untick');
      pull.ready = ready;
    };
    const end = () => {
      tracking = false;
      if (!pull.pulling) return;
      pull.pulling = false;
      if (pull.ready) refresh();
      else pull.offset = 0;
      pull.ready = false;
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

<!-- A page without a top bar: its own dice, in the gap the pull opens. -->
{#if pull.hosts === 0 && (pull.offset > 0 || pull.refreshing)}
  <div class="pullgap" class:pulling={pull.pulling} style:height="{pull.offset}px">
    <span class="pullmark" class:ready={pull.ready} class:going={pull.refreshing} style:--turn="{pull.offset * 4}deg">
      <Logo size={28} />
    </span>
  </div>
{/if}
<!-- Leaving: the page fades to the ground under the top bar, whose dice keeps spinning, and the new one loads. -->
{#if leaving}<div class="pullveil" role="status"><span class="pullword">Refreshing</span></div>{/if}

<style>
  .pullgap {
    position: fixed; left: 0; right: 0; top: 0; z-index: 31; pointer-events: none; overflow: hidden;
    display: grid; place-items: center; padding-top: env(safe-area-inset-top, 0px); box-sizing: content-box;
    transition: height 0.28s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .pullgap.pulling { transition: none; }
  .pullmark { display: grid; place-items: center; color: var(--text); transform: rotate(var(--turn)); transition: color 0.2s var(--ease-out); }
  .pullmark.ready, .pullmark.going { color: var(--a); }
  .pullmark.going { animation: pullspin 0.9s linear infinite; }
  @keyframes pullspin { from { transform: rotate(var(--turn)); } to { transform: rotate(calc(var(--turn) + 360deg)); } }
  /* Under the top bar (z 30), over everything else on the page. */
  .pullveil {
    position: fixed; inset: 0; z-index: 29; background: var(--bg); pointer-events: none;
    animation: pullveil 0.3s cubic-bezier(0.33, 1, 0.68, 1) both;
  }
  @keyframes pullveil { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .pullmark.going, .pullveil { animation: none; }
    .pullgap { transition: none; }
  }
  .pullword { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
