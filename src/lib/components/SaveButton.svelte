<script lang="ts">
  /**
   * Saves the sheet as a fillable PDF (lib/pdf), to print or keep, with the
   * sheet inside it for Import (lib/pdf/backup). The arrow drops into its
   * tray on hover, keeps dropping while the PDF is made, and the tray turns
   * to a check once it is saved.
   */
  let { onsave, busy = false, saved = false }: { onsave: () => void; busy?: boolean; saved?: boolean } = $props();
  const TIP = 'Save as a PDF, to print or keep. Import brings the character back from it. Edits made in the PDF don’t come back, and saving it again from another app can leave the sheet out of it.';
</script>

<button class="savepdf" class:busy class:saved onclick={onsave} disabled={busy} aria-busy={busy}
        aria-label="Save the sheet as a PDF" title={busy ? 'Making the PDF' : TIP}>
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      {#if saved}
        <path class="tick" d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2" />
      {:else}
        <path class="arrow" d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5" />
        <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
      {/if}
    </g>
  </svg>
</button>

<style>
  .savepdf {
    display: inline-grid; place-items: center; width: 2rem; height: 2rem; flex: none; padding: 0;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    color: var(--text); cursor: pointer;
    transition: border-color 0.18s var(--ease-out), color 0.18s var(--ease-out), background-color 0.18s var(--ease-out), transform 0.08s var(--ease-out);
  }
  .savepdf:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .savepdf:active:not(:disabled) { transform: translateY(1px); }
  .savepdf:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .savepdf.busy { cursor: progress; color: var(--a); border-color: var(--a-edge); }
  .savepdf.saved { color: var(--a); border-color: var(--a-edge); background: var(--a-wash); }
  .savepdf svg { display: block; overflow: visible; }
  /* The arrow drops into the tray once; while the PDF is made it keeps dropping. */
  .savepdf:hover:not(.busy) .arrow { animation: drop 0.5s cubic-bezier(0.33, 1, 0.68, 1); }
  .savepdf.busy .arrow { animation: drop 0.9s cubic-bezier(0.33, 1, 0.68, 1) infinite; }
  .tick { stroke-dasharray: 22; animation: tick 0.35s cubic-bezier(0.33, 1, 0.68, 1); }
  @keyframes drop { 0% { transform: translateY(-5px); opacity: 0; } 100% { transform: none; opacity: 1; } }
  @keyframes tick { from { stroke-dashoffset: 22; } }
  @media (prefers-reduced-motion: reduce) { .savepdf .arrow, .tick { animation: none !important; } }
</style>
