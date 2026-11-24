<script lang="ts">
  /** Light or dark, for this device. Sits with the other header controls. */
  import { mode, toggleMode } from '#lib/stores/mode.ts';

  /** The switch fades the new look in over the old (stores/mode crossfade). */
  const flip = () => toggleMode();

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
    transition: border-color 0.18s var(--ease-out), color 0.18s var(--ease-out), background-color 0.18s var(--ease-out), transform 0.08s var(--ease-out);
  }
  .mode:hover { border-color: var(--a-edge); color: var(--a); }
  .mode:active { transform: translateY(1px); }
  .mode svg { display: block; transition: transform 0.45s cubic-bezier(0.3, 0.7, 0.4, 1); }
  /* The sun turns a little; the moon tips, as if setting. */
  .mode:hover svg.sun { transform: rotate(45deg); }
  .mode:hover svg.moon { transform: rotate(-18deg); }
  @media (prefers-reduced-motion: reduce) { .mode svg { transition: none; } }
</style>
