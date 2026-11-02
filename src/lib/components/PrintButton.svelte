<script lang="ts">
  /** Prints the paper version of the sheet; see PrintSheet. */
  let { onprint = () => window.print() }: { onprint?: () => void } = $props();
</script>

<button class="print" onclick={onprint} aria-label="Print this sheet" title="Print this sheet">
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
  .print:hover { border-color: var(--a-edge); color: var(--a); }
  .print:active { transform: translateY(1px); }
  .print svg { display: block; overflow: visible; }
  /* The page feeds out of the printer once. */
  .print:hover .paper { animation: feed 0.6s cubic-bezier(0.3, 0.7, 0.4, 1); }
  @keyframes feed { 0% { transform: translateY(-3px); opacity: 0.4; } 100% { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .print:hover .paper { animation: none; } }
</style>
