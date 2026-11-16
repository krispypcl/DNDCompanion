<script lang="ts">
  /**
   * Page arrows and where you are ("Page 2 of 5"): the notes and backstory
   * pages, and the main menu's pages of cards, turn the same way.
   */
  let { page, count, onturn }: { page: number; count: number; onturn: (to: number) => void } = $props();
</script>

<div class="turns">
  <button class="nav" aria-label="Previous page" disabled={page <= 0} onclick={() => onturn(page - 1)}>
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>
  <span class="count" aria-live="polite">Page {page + 1} of {count}</span>
  <button class="nav" aria-label="Next page" disabled={page >= count - 1} onclick={() => onturn(page + 1)}>
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" /></svg>
  </button>
</div>

<style>
  .turns { display: inline-flex; align-items: center; gap: 0.5rem; }
  .count { font-size: 0.78rem; color: var(--dim); font-variant-numeric: tabular-nums; min-width: 5.75rem; text-align: center; white-space: nowrap; }
  .nav {
    display: inline-grid; place-items: center; width: 1.875rem; height: 1.875rem;
    background: var(--raised); border: 1px solid var(--line); color: var(--text);
    border-radius: var(--r-sm); cursor: pointer; padding: 0;
    transition: border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease, transform 0.08s ease;
  }
  .nav:hover:not(:disabled) { border-color: var(--a-edge); color: var(--a); }
  .nav:active:not(:disabled) { transform: translateY(1px); }
  .nav:focus-visible { outline: 2px solid var(--a); outline-offset: 2px; }
  .nav:disabled { opacity: 0.35; cursor: default; }
  @media (max-width: 700px) {
    .nav { width: 2.25rem; height: 2.25rem; }
  }
</style>
