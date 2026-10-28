<script lang="ts">
  import { fade } from 'svelte/transition';

  let {
    tabs,
    active = $bindable(),
    children
  }: {
    tabs: string[];
    active: string;
    children: import('svelte').Snippet<[string]>;
  } = $props();

  function select(tab: string) {
    active = tab;
    if (typeof location !== 'undefined') {
      history.replaceState(null, '', `#${tab.toLowerCase()}`);
    }
  }
</script>

<div class="tablist" role="tablist">
  {#each tabs as tab (tab)}
    <button
      role="tab"
      aria-selected={active === tab}
      class:active={active === tab}
      onclick={() => select(tab)}
    >
      {tab}
    </button>
  {/each}
</div>

{#key active}
  <section role="tabpanel" in:fade={{ duration: 140 }}>
    {@render children(active)}
  </section>
{/key}

<style>
  .tablist {
    display: flex;
    gap: 1.25rem;
    border-bottom: 1px solid var(--line-soft);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tablist::-webkit-scrollbar { display: none; }
  button {
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;
    color: var(--dim);
    font: inherit;
    font-size: 0.9rem;
    padding: 0.5rem 0 0.6875rem;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  button:hover { color: var(--text); }
  .active { color: var(--a); border-bottom-color: var(--a); }
  section { padding: 1rem 0 0; }
</style>
