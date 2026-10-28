<script lang="ts">
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

{#if $sheetStore.status === 'stale'}
  <div class="stale-banner" role="alert">
    <span>{$sheetStore.message}</span>
    <button onclick={() => location.reload()}>Reload</button>
  </div>
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
  .stale-banner {
    position: fixed;
    inset-inline: 0;
    bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    margin-inline: auto;
    width: min(28rem, calc(100% - 2rem));
    background: var(--surface);
    border: 1px solid var(--accent);
    border-radius: 8px;
    padding: 0.7rem 0.9rem;
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
  }
  .stale-banner button {
    background: var(--accent);
    color: #1a1a18;
    border: 0;
    border-radius: 5px;
    padding: 0.35rem 0.7rem;
    font: inherit;
    cursor: pointer;
  }
</style>
