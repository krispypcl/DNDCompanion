<script lang="ts">
  /**
   * The state of the autosave, as a dot of fixed size.
   *
   * It used to be a word, which changed width as it changed state — and on a
   * phone "Not saved" appearing in the controls row pushed the buttons onto a
   * second line and shoved the whole sheet down. A status that moves the page
   * every time you type is worse than no status. This one occupies the same
   * space in every state, including when there is nothing to say, so the row
   * is laid out once and never again.
   *
   * The words still exist for anyone who needs them: as the title, as live
   * text for a screen reader, and — when something has actually gone wrong —
   * in SaveAlert, which floats over the sheet instead of displacing it.
   */
  import { sheetStore } from '$lib/stores/sheet';

  const LABELS: Record<string, string> = {
    idle: '',
    saving: 'Saving…',
    saved: 'Saved',
    unsaved: 'Not saved yet',
    stale: 'Changed elsewhere',
    error: 'Error'
  };

  /** `unsaved` means both "queued" and "gave up", told apart by the message. */
  const failed = $derived(
    $sheetStore.status === 'stale' ||
      $sheetStore.status === 'error' ||
      ($sheetStore.status === 'unsaved' && Boolean($sheetStore.message))
  );
  const label = $derived(
    failed && $sheetStore.message ? $sheetStore.message : LABELS[$sheetStore.status]
  );
</script>

<span
  class="dot {$sheetStore.status}"
  class:failed
  title={label}
  role="status"
  aria-live="polite"
>
  <span class="sr">{label}</span>
</span>

<style>
  .dot {
    /* Reserved whatever the state, so the row is measured once. */
    display: inline-block;
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: transparent;
    transition: background-color 0.3s ease;
  }
  .saving { background: var(--dim); animation: breathe 1.1s ease-in-out infinite; }
  .saved { background: var(--a); }
  .unsaved { background: var(--label); }
  .failed { background: var(--danger); }

  @keyframes breathe {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 1; }
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
