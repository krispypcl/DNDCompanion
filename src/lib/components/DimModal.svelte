<!--
  A window over the page, the page dimmed and blurred behind it (as behind a
  picture opened from Appearance). It eases in, rising a little as it grows,
  and fades back out; a press on the dimmed page, Esc, or the window's own
  Done closes it. Its title is what you drag to move it.

  On a phone it is a sheet rising from the bottom instead, as wide as the
  screen, with a grab handle: dragged down far enough (or flicked) it goes,
  otherwise it settles back. Its × closes it too.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { backdrop, focusFirst, movable, portal } from '#lib/actions.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';
  import { phone } from '#lib/stores/phone.svelte.ts';

  let {
    id, title, wide = false, broad = false, closer = false, fixed = false, onclose, children
  }: {
    id: string; title: string; wide?: boolean;
    /** Wider still, for a long form (a monster and its stat block). */
    broad?: boolean;
    /** A × at the top right on a computer too (a phone's sheet always has one), in place of a Done button. */
    closer?: boolean;
    /** Stays in the middle: not moved by its title. */
    fixed?: boolean;
    onclose: () => void; children: Snippet;
  } = $props();

  // Fixed for the window's life: a sheet stays a sheet if the phone turns.
  const asSheet = phone.current;

  /** In: grows from just under its size and rises into place. Out: a quick fade, shrinking a touch. */
  function rise(_node: Element, { out = false } = {}) {
    const still = prefersReducedMotion();
    if (asSheet) {
      return {
        duration: still ? 0 : out ? 200 : 300,
        easing: cubicOut,
        css: (t: number) => `transform: translateY(${(1 - t) * 100}%);`
      };
    }
    return {
      duration: still ? 0 : out ? 150 : 260,
      easing: cubicOut,
      css: (t: number) => `opacity: ${t}; transform: translateY(${(1 - t) * (out ? 4 : 10)}px) scale(${(out ? 0.985 : 0.965) + (1 - (out ? 0.985 : 0.965)) * t});`
    };
  }

  // ── Dragged down to close (a phone's sheet), by its handle or title.
  let pull = $state(0);
  let held: { y: number; t: number; id: number } | null = null;
  function grab(e: PointerEvent) {
    if (!asSheet || e.button !== 0) return;
    if ((e.target as Element).closest('button, a, input, select, textarea, label')) return;
    held = { y: e.clientY, t: performance.now(), id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function drag(e: PointerEvent) {
    if (!held || e.pointerId !== held.id) return;
    pull = Math.max(0, e.clientY - held.y);
  }
  function letGo(e: PointerEvent) {
    if (!held || e.pointerId !== held.id) return;
    const speed = pull / Math.max(1, performance.now() - held.t);
    held = null;
    if (pull > 110 || (pull > 30 && speed > 0.6)) onclose();
    else pull = 0;
  }
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onclose(); } }} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="dimscrim" class:sheet={asSheet} use:portal transition:fade={{ duration: prefersReducedMotion() ? 0 : 200, easing: cubicOut }}
     use:backdrop={onclose}>
  <div class="dimwindow themed-scroll" class:wide class:broad class:sheet={asSheet} class:pulling={pull > 0} role="dialog" aria-modal="true" aria-labelledby={id}
       use:movable={{ enabled: !asSheet && !fixed }} use:focusFirst style:transform={pull ? `translateY(${pull}px)` : undefined}
       in:rise out:rise={{ out: true }}>
    {#if asSheet}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="grabzone" onpointerdown={grab} onpointermove={drag} onpointerup={letGo} onpointercancel={letGo}>
        <span class="grab" aria-hidden="true"></span>
        <div class="sheethead">
          <h2 {id}>{title}</h2>
          <button class="closex" aria-label="Close" title="Close" onclick={onclose}>×</button>
        </div>
      </div>
    {:else if closer}
      <div class="sheethead">
        <h2 {id}>{title}</h2>
        <button class="closex" aria-label="Close" title="Close (Esc)" onclick={onclose}>×</button>
      </div>
    {:else}
      <h2 {id}>{title}</h2>
    {/if}
    {@render children()}
  </div>
</div>

<style>
  .dimscrim {
    position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 1rem;
    background: rgb(0 0 0 / 0.78); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  }
  .dimwindow {
    width: min(30rem, 100%); max-height: calc(100vh - 2rem); overflow-y: auto;
    padding: 1.125rem 1.25rem 1.25rem; border-radius: var(--r);
    background: var(--surface); border: 1px solid var(--line); box-shadow: 0 24px 60px rgb(0 0 0 / 0.5);
  }
  .dimwindow.wide { width: min(46rem, 100%); }
  .dimwindow.broad { width: min(84rem, 100%); }
  h2 { margin: 0 0 0.875rem; font-size: 1rem; font-weight: 650; color: var(--a); overflow-wrap: anywhere; }

  /* A phone: a sheet from the bottom, the full width, its top rounded. */
  .dimscrim.sheet { place-items: end stretch; padding: 0; background: rgb(0 0 0 / 0.6); }
  .dimwindow.sheet {
    width: 100%; max-height: 90dvh; border-radius: 1.125rem 1.125rem 0 0; border-bottom: 0;
    padding: 0 1rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -12px 40px rgb(0 0 0 / 0.4); overscroll-behavior: contain;
    transition: transform 0.28s cubic-bezier(0.33, 1, 0.68, 1);
  }
  .dimwindow.sheet.pulling { transition: none; }
  /* The handle and title stay put while what is under them scrolls. */
  .grabzone {
    position: sticky; top: 0; z-index: 2; margin: 0 -1rem 0.75rem; padding: 0.5rem 1rem 0.625rem;
    background: var(--surface); border-bottom: 1px solid var(--line-soft); touch-action: none; cursor: grab;
  }
  .grab { display: block; width: 2.5rem; height: 0.3125rem; margin: 0 auto 0.5rem; border-radius: 999px; background: var(--line); }
  .sheethead { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }
  .sheethead h2 { margin: 0; }
  .sheethead .closex { flex: none; --x-size: 1.875rem; }
  /* On a computer, with its ×: the title's own space below it. */
  .dimwindow > .sheethead { margin-bottom: 0.875rem; }
</style>
