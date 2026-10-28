<script lang="ts">
  import { fly } from 'svelte/transition';

  let { label, onundo, onexpire }: {
    label: string | null;
    onundo: () => void;
    onexpire: () => void;
  } = $props();

  const LINGER_MS = 10_000;
  let timer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    clearTimeout(timer);
    if (label) timer = setTimeout(onexpire, LINGER_MS);
    return () => clearTimeout(timer);
  });
</script>

{#if label}
  <div class="toast" role="status" transition:fly={{ y: 16, duration: 200 }}>
    <span>{label}</span>
    <button onclick={onundo}>Undo</button>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    inset-inline: 0;
    bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    margin-inline: auto;
    width: min(24rem, calc(100% - 2rem));
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.65rem 0.9rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.875rem;
    z-index: 20;
  }
  button {
    background: none;
    border: 1px solid var(--accent);
    color: var(--accent);
    border-radius: 5px;
    padding: 0.3rem 0.7rem;
    font: inherit;
    cursor: pointer;
  }
  button:hover { background: var(--accent); color: #1a1a18; }
</style>
