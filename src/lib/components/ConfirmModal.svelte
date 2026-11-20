<!--
  A question to confirm in a window of its own (DimModal: a sheet from the
  bottom on a phone): what happens, then the button that does it and the
  one that keeps things as they are. A phone's narrow cards have no room
  for the question beside their buttons, so it comes up here instead.
-->
<script lang="ts">
  import DimModal from './DimModal.svelte';

  let {
    title,
    message = '',
    yes,
    no = 'Keep',
    busy = false,
    busyLabel,
    onyes,
    onclose
  }: {
    title: string;
    /** One plain sentence on what follows, when the title alone doesn't say. */
    message?: string;
    /** The button that does it ("Delete", "Leave"). */
    yes: string;
    /** The button that keeps things as they are. */
    no?: string;
    busy?: boolean;
    busyLabel?: string;
    onyes: () => void | Promise<void>;
    onclose: () => void;
  } = $props();
  const id = `confirm-${Math.random().toString(36).slice(2, 8)}`;
</script>

<DimModal {id} {title} {onclose}>
  {#if message}<p class="confirmwhy">{message}</p>{/if}
  <div class="confirmrow">
    <button class="smallbtn quiet confirmno" onclick={onclose}>{no}</button>
    <button class="smallbtn danger confirmyes" disabled={busy} onclick={() => onyes()}>{busy ? (busyLabel ?? yes) : yes}</button>
  </div>
</DimModal>

<style>
  .confirmwhy { margin: 0 0 1rem; color: var(--dim); font-size: 0.875rem; line-height: 1.5; }
  .confirmrow { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; }
  .confirmrow .smallbtn { min-height: 2.75rem; font-size: 0.9375rem; }
  .confirmyes { color: var(--bad); border-color: color-mix(in oklab, var(--bad) 55%, transparent); }
  .confirmyes:hover:not(:disabled) { color: var(--bad); border-color: var(--bad); background: color-mix(in oklab, var(--bad) 12%, transparent); }
</style>
