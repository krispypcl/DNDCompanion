<script lang="ts">
  /** Light or dark, for this device. Sits with the other header controls. */
  import { tick } from 'svelte';
  import { mode, toggleMode } from '#lib/stores/mode.ts';
  import { prefersReducedMotion } from '#lib/motion.ts';

  type Transitioning = Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } };

  /**
   * The old look fades into the new as one picture (a view transition), so
   * the cost is the same however much is on the page. Easing every element's
   * colours at once, as before, made a full campaign page stutter: each frame
   * restyled hundreds of elements and redrew every frosted layer. Without
   * view transitions (or with reduced motion) it simply switches.
   */
  function flip() {
    const doc = document as Transitioning;
    if (prefersReducedMotion() || !doc.startViewTransition) return toggleMode();
    const root = document.documentElement;
    root.classList.add('mode-fade');
    doc
      .startViewTransition(async () => {
        toggleMode();
        await tick();
      })
      .finished.finally(() => root.classList.remove('mode-fade'));
  }

  const next = $derived($mode === 'dark' ? 'light' : 'dark');
</script>

<button
  class="mode"
  onclick={flip}
  aria-pressed={$mode === 'light'}
  aria-label="Switch to {next} mode"
  title="Switch to {next} mode"
>
  {#if $mode === 'dark'}
    <!-- Dark now, so offer the sun. -->
    <svg class="sun" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6" />
      <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M12 2.6v2.2M12 19.2v2.2M4.4 12H2.2M21.8 12h-2.2" />
        <path d="M6.6 6.6 5 5M19 19l-1.6-1.6M17.4 6.6 19 5M5 19l1.6-1.6" />
      </g>
    </svg>
  {:else}
    <svg class="moon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
      />
    </svg>
  {/if}
</button>

<style>
  .mode {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    flex: none;
    background: var(--raised);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    color: var(--text);
    cursor: pointer;
    padding: 0;
    transition: border-color 0.18s ease, color 0.18s ease, background-color 0.18s ease, transform 0.08s ease;
  }
  .mode:hover { border-color: var(--a-edge); color: var(--a); }
  .mode:active { transform: translateY(1px); }
  .mode svg { display: block; transition: transform 0.45s cubic-bezier(0.3, 0.7, 0.4, 1); }
  /* The sun turns a little; the moon tips, as if setting. */
  .mode:hover svg.sun { transform: rotate(45deg); }
  .mode:hover svg.moon { transform: rotate(-18deg); }
  @media (prefers-reduced-motion: reduce) { .mode svg { transition: none; } }
</style>
