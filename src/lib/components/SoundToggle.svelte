<script lang="ts">
  /** Sound effects on or off, for this device. Beside the light/dark switch. */
  import { setSound, soundOn } from '$lib/sound';
</script>

<button class="sound" class:on={$soundOn} onclick={() => setSound(!$soundOn)} aria-pressed={$soundOn}
        aria-label={$soundOn ? 'Turn sound effects off' : 'Turn sound effects on'}
        title={$soundOn ? 'Sound effects on' : 'Sound effects off'}>
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" fill-opacity="0.12" />
      {#if $soundOn}
        <path class="wave w1" d="M15.5 9.2a4 4 0 0 1 0 5.6" />
        <path class="wave w2" d="M18.2 6.8a7.5 7.5 0 0 1 0 10.4" />
      {:else}
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      {/if}
    </g>
  </svg>
</button>

<style>
  .sound {
    display: inline-grid; place-items: center; width: 2rem; height: 2rem; flex: none; padding: 0;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    color: var(--text); cursor: pointer;
    transition: border-color 0.18s ease, color 0.18s ease, transform 0.08s ease;
  }
  .sound:hover { border-color: var(--a-edge); color: var(--a); }
  .sound:active { transform: translateY(1px); }
  .sound.on { color: var(--a); }
  .sound svg { display: block; overflow: visible; }
  /* Turned on, the waves ripple out once. */
  .wave { animation: wave 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) backwards; }
  .w2 { animation-delay: 0.08s; }
  @keyframes wave { from { opacity: 0; transform: translateX(-3px); } }
  @media (prefers-reduced-motion: reduce) { .wave { animation: none; } }
</style>
