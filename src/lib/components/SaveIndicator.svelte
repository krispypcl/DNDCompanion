<script lang="ts">
  /** The one-word state of the autosave, beside the sheet's controls. The
      alert that a write was refused lives in StaleBanner: it floats over the
      page, and the header is a stacking context of its own. */
  import { sheetStore } from '$lib/stores/sheet';

  const LABELS: Record<string, string> = {
    idle: '',
    saving: 'Saving…',
    saved: 'Saved',
    unsaved: 'Not saved',
    stale: 'Changed elsewhere',
    error: 'Error'
  };
</script>

{#if $sheetStore.status !== 'idle'}
  <span class="indicator {$sheetStore.status}" role="status" title={$sheetStore.message ?? ''}>
    {LABELS[$sheetStore.status]}
  </span>
{/if}

<style>
  .indicator {
    font-size: 0.75rem;
    color: var(--dim);
    transition: opacity 0.4s ease;
  }
  .saved {
    animation: pulse 1.2s ease forwards;
  }
  .unsaved,
  .error {
    color: var(--bad);
  }
  .stale {
    color: var(--accent);
  }
  @keyframes pulse {
    0% { opacity: 1; }
    70% { opacity: 1; }
    100% { opacity: 0.35; }
  }
</style>
