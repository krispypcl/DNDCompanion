<script lang="ts">
  /** Saves the whole character as a text file that Import can read back. */
  let { ondownload }: { ondownload: () => void } = $props();

  let done = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function press() {
    ondownload();
    done = true;
    clearTimeout(timer);
    timer = setTimeout(() => (done = false), 1600);
  }
</script>

<button class="dl" class:done onclick={press} aria-label="Download this sheet"
        title="Download this sheet as a text file you can import again">
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      {#if done}
        <path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2" />
      {:else}
        <path d="M12 4v11" />
        <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
        <path d="M5 19.5h14" />
      {/if}
    </g>
  </svg>
</button>

<style>
  .dl {
    display: inline-grid; place-items: center;
    width: 2rem; height: 2rem; flex: none;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    color: var(--text); cursor: pointer; padding: 0;
    transition: border-color 0.18s ease, color 0.18s ease, background-color 0.18s ease, transform 0.08s ease;
  }
  .dl:hover { border-color: var(--a-edge); color: var(--a); }
  .dl:active { transform: translateY(1px); }
  .dl.done { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .dl svg { display: block; }
  /* The arrow dips once, as if dropping into the tray. */
  .dl:hover:not(.done) svg { animation: drop 0.5s cubic-bezier(0.3, 0.7, 0.4, 1); }
  @keyframes drop {
    0%, 100% { transform: translateY(0); }
    45% { transform: translateY(2px); }
  }
  @media (prefers-reduced-motion: reduce) { .dl:hover svg { animation: none; } }
</style>
