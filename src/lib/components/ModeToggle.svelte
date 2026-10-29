<script lang="ts">
  /** Light or dark, for this device. Sits with the other header controls. */
  import { mode, toggleMode } from '$lib/stores/mode';
  import { prefersReducedMotion } from '$lib/motion';

  let shifting = 0;

  function flip() {
    // Every colour in the app changes at once; without the class it snaps.
    if (!prefersReducedMotion()) {
      const root = document.documentElement;
      root.classList.add('mode-shift');
      clearTimeout(shifting);
      shifting = window.setTimeout(() => root.classList.remove('mode-shift'), 280);
    }
    toggleMode();
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
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6" />
      <g stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <path d="M12 2.6v2.2M12 19.2v2.2M4.4 12H2.2M21.8 12h-2.2" />
        <path d="M6.6 6.6 5 5M19 19l-1.6-1.6M17.4 6.6 19 5M5 19l1.6-1.6" />
      </g>
    </svg>
  {:else}
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
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
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    color: var(--dim);
    cursor: pointer;
    padding: 0;
    transition: border-color 0.18s ease, color 0.18s ease, background-color 0.18s ease;
  }
  .mode:hover { border-color: var(--a-edge); color: var(--a); }
  .mode svg { display: block; }
</style>
