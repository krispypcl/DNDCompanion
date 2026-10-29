<script lang="ts">
  /**
   * Something was written and did not land: another tab got there first, or
   * the save failed outright. The sheet still shows what was typed, so this
   * says so where it cannot be missed and cannot displace anything — a save
   * that quietly did not happen is the one failure worth interrupting for.
   *
   * It floats at the sheet's root rather than in the header, which sits above
   * the banner and is therefore a stacking context of its own: an alert
   * inside one cannot rise over the modules whatever z-index it asks for.
   */
  import { sheetStore } from '$lib/stores/sheet';

  // `unsaved` is also the ordinary "queued" state; only the one carrying a
  // message is a failure.
  const stale = $derived($sheetStore.status === 'stale');
  const shown = $derived(
    stale ||
      $sheetStore.status === 'error' ||
      ($sheetStore.status === 'unsaved' && Boolean($sheetStore.message))
  );
</script>

{#if shown}
  <div class="stale-banner" role="alert">
    <span>{$sheetStore.message ?? 'Could not save'}</span>
    {#if stale}
      <button onclick={() => location.reload()}>Reload</button>
    {/if}
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
  /* On a phone the other two messages run the width of the screen, so this
     clears the save word as well as the undo toast beneath it. */
  @media (max-width: 700px) {
    .stale-banner { bottom: calc(8rem + env(safe-area-inset-bottom, 0px)); }
  }
</style>
