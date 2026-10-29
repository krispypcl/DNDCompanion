<script lang="ts">
  /**
   * Someone else's write landed first and this tab's was refused. It floats
   * over the sheet, so it is rendered at the sheet's root rather than inside
   * the header: a header that sits above the banner is a stacking context,
   * and an alert inside one cannot rise above the modules.
   */
  import { sheetStore } from '$lib/stores/sheet';
</script>

{#if $sheetStore.status === 'stale'}
  <div class="stale-banner" role="alert">
    <span>{$sheetStore.message}</span>
    <button onclick={() => location.reload()}>Reload</button>
  </div>
{/if}

<style>
  .stale-banner {
    position: fixed;
    /* Above the modules: a bannered sheet gives its panels a stacking order
       so they sit over the banner, and anything floating over the sheet has
       to clear that. Below the splash, which is 60. */
    z-index: 40;
    inset-inline: 0;
    /* Clear of the undo toast, which lives at the same edge: when a write is
       refused mid-session both can be on screen at once. */
    bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px));
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
    color: var(--on-accent);
    border: 0;
    border-radius: 5px;
    padding: 0.35rem 0.7rem;
    font: inherit;
    cursor: pointer;
  }
</style>
