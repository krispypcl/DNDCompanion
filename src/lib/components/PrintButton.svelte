<script lang="ts">
  /**
   * Saves the sheet as a fillable PDF (lib/pdf), to print or keep, with the
   * sheet inside it for Import (lib/pdf/backup). While it is being made the
   * page keeps feeding out of the printer.
   */
  let { onprint, busy = false }: { onprint: () => void; busy?: boolean } = $props();
  const PDF_TIP = 'Save as a PDF, to print or keep (P). Import brings the character back from it. Edits made in the PDF don’t come back, and saving it again from another app can leave the sheet out of it.';
</script>

<button class="print" class:busy onclick={onprint} disabled={busy} aria-busy={busy}
        aria-label="Save the sheet as a PDF" title={busy ? 'Making the PDF' : PDF_TIP}>
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 9V4h10v5" />
      <rect x="4" y="9" width="16" height="7" rx="1.5" />
      <path class="paper" d="M7 14h10v6H7z" />
    </g>
  </svg>
</button>

<style>
  .print {
    display: inline-grid; place-items: center; width: 2rem; height: 2rem; flex: none; padding: 0;
    background: var(--raised); border: 1px solid var(--line); border-radius: var(--r-sm);
    color: var(--text); cursor: pointer;
    transition: border-color 0.18s ease, color 0.18s ease, transform 0.08s ease;
  }
  .print:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .print:active:not(:disabled) { transform: translateY(1px); }
  .print:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .print.busy { cursor: progress; color: var(--a); border-color: var(--a-edge); }
  .print svg { display: block; overflow: visible; }
  /* The page feeds out of the printer once; while the PDF is made, it keeps feeding. */
  .print:hover .paper { animation: feed 0.6s cubic-bezier(0.33, 1, 0.68, 1); }
  .print.busy .paper { animation: feed 0.9s cubic-bezier(0.33, 1, 0.68, 1) infinite; }
  @keyframes feed { 0% { transform: translateY(-3px); opacity: 0.4; } 100% { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .print:hover .paper, .print.busy .paper { animation: none; } }
</style>
