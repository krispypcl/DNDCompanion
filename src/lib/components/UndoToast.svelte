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
    /* Above the modules: a bannered sheet gives its panels a stacking order
       so they sit over the banner, and anything floating over the sheet has
       to clear that. Below the splash, which is 60. */
    z-index: 40;
    inset-inline: 0;
    bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    margin-inline: auto;
    width: min(24rem, calc(100% - 2rem));
    background: var(--surface);
    border: 1px solid var(--line);
    border-left: 3px solid var(--a);
    border-radius: 8px;
    box-shadow: 0 8px 28px rgb(0 0 0 / 0.3);
    padding: 0.65rem 0.9rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.875rem;
  }
  /* In the sheet's own accent, like every other control on it. */
  button {
    background: var(--a-wash);
    border: 1px solid var(--a-edge);
    color: var(--a);
    border-radius: var(--r-sm);
    padding: 0.3rem 0.7rem;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.08s ease;
  }
  button:hover { background: var(--a); border-color: var(--a); color: var(--on-accent); }
  button:active { transform: translateY(1px); }
</style>
