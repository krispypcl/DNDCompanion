<script lang="ts">
  /**
   * A small speaker to hear a sound. Pressed, its waves ripple out for a
   * moment, so it is plain that something played even with the volume low.
   */
  let { label, onplay, disabled = false }: { label: string; onplay: () => void; disabled?: boolean } = $props();
  let playing = $state(0);
  let timer: ReturnType<typeof setTimeout> | undefined;
  function press() {
    onplay();
    playing += 1;
    clearTimeout(timer);
    timer = setTimeout(() => (playing = 0), 900);
  }
</script>

<button type="button" class="speaker" class:playing={playing > 0} aria-label={label} title={label} {disabled} onclick={press}>
  {#key playing}
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M3 7.5h2.6L9.5 4v12l-3.9-3.5H3z" fill="currentColor" />
      <path class="w1" d="M12.2 7.3a3.6 3.6 0 0 1 0 5.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      <path class="w2" d="M14.6 5a6.8 6.8 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  {/key}
</button>

<style>
  .speaker {
    width: 1.5rem; height: 1.5rem; padding: 0; flex: none; display: inline-grid; place-items: center; cursor: pointer;
    border: 1px solid var(--line); border-radius: 50%; background: var(--raised); color: var(--dim);
    transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease, transform 0.1s ease;
  }
  .speaker:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); background: var(--a-wash); }
  .speaker:active:not(:disabled) { transform: translateY(1px); }
  .speaker:focus-visible { outline: 2px solid var(--a); outline-offset: 1px; }
  .speaker:disabled { opacity: 0.5; cursor: default; }
  .speaker.playing { color: var(--a); border-color: var(--a-edge); }
  .playing .w1, .playing .w2 { animation: wave 0.85s ease-out both; }
  .playing .w2 { animation-delay: 0.12s; }
  @keyframes wave {
    0% { opacity: 0.2; transform: translateX(-1.5px); }
    40% { opacity: 1; transform: none; }
    100% { opacity: 1; transform: none; }
  }
  path { transform-box: fill-box; }
  @media (prefers-reduced-motion: reduce) { .playing .w1, .playing .w2 { animation: none; } }
</style>
