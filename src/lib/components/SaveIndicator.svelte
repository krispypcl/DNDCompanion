<script lang="ts">
  /**
   * The state of the autosave, in words, in the bottom corner.
   *
   * It began as a word in the header, where its changing width pushed the
   * controls onto a second line on a phone and shoved the sheet down. Then it
   * was a coloured dot, which does not move anything but asks the reader to
   * know what the colour means — and the accent is the character's own, so a
   * red character would report a red "saved".
   *
   * Floating in the corner, it can say the word and still move nothing. The
   * colour is deliberately neutral: the sentence carries the meaning, not the
   * hue. A write that actually failed also raises SaveAlert, which is harder
   * to miss than a corner.
   */
  import { fly } from 'svelte/transition';
  import { sheetStore } from '$lib/stores/sheet';
  import { prefersReducedMotion } from '$lib/motion';

  const LABELS: Record<string, string> = {
    idle: '',
    saving: 'Saving…',
    saved: 'Saved',
    unsaved: 'Not saved',
    stale: 'Changed elsewhere',
    error: 'Error'
  };

  /** Saved is good news and short-lived; everything else stays up. */
  const SETTLE_MS = 1800;
  let settled = $state(false);

  $effect(() => {
    const status = $sheetStore.status;
    if (status !== 'saved') {
      settled = false;
      return;
    }
    settled = false;
    const timer = setTimeout(() => (settled = true), SETTLE_MS);
    return () => clearTimeout(timer);
  });

  const shown = $derived($sheetStore.status !== 'idle' && !settled);
  const label = $derived(LABELS[$sheetStore.status] ?? '');
  const motion = $derived(prefersReducedMotion() ? 0 : 180);
</script>

{#if shown}
  <p class="saveword" role="status" aria-live="polite" transition:fly={{ y: 8, duration: motion }}>
    {label}
  </p>
{/if}

<style>
  .saveword {
    position: fixed;
    z-index: 40;
    right: 1rem;
    bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    margin: 0;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--r-sm);
    padding: 0.3125rem 0.625rem;
    /* No accent here on purpose: the word says what happened. */
    color: var(--dim);
    font-size: 0.75rem;
    pointer-events: none;
  }

  /* A phone's other messages run the width of the screen, so this clears
     them rather than landing on top. */
  @media (max-width: 700px) {
    .saveword { bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px)); }
  }
</style>
