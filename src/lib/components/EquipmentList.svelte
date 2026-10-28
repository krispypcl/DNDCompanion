<script lang="ts">
  import EntryLink from './EntryLink.svelte';
  import type { Definition, Item } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: { definition: Definition; editable: boolean; onchange: (next: Definition) => void } = $props();

  function patch(index: number, key: keyof Item, value: string) {
    const equipment = definition.equipment.map((it, i) =>
      i === index ? { ...it, [key]: key === 'qty' ? Number(value) : value } : it
    );
    onchange({ ...definition, equipment });
  }

  function add() {
    onchange({ ...definition, equipment: [...definition.equipment, { name: 'New item', qty: 1 }] });
  }

  function remove(index: number) {
    onchange({ ...definition, equipment: definition.equipment.filter((_, i) => i !== index) });
  }

</script>

{#if definition.equipment.length === 0 && !editable}
  <p class="empty">Nothing carried.</p>
{:else}
  <ul>
    {#each definition.equipment as item, i (i)}
      <li>
        {#if editable}
          <input class="qty" type="number" value={item.qty ?? 1} aria-label="Quantity" onchange={(e) => patch(i, 'qty', e.currentTarget.value)} />
          <input value={item.name} placeholder="Tinderbox" aria-label="Item name" onchange={(e) => patch(i, 'name', e.currentTarget.value)} />
          <button class="x" onclick={() => remove(i)} aria-label="Remove {item.name}">×</button>
        {:else}
          <span class="qty-read">{item.qty ?? 1}×</span>
          <span class="nm">{item.name}</span>
          <EntryLink name={item.name} source={item.source} category="items" override={item.lookupUrl} />
        {/if}
      </li>
    {/each}
  </ul>
{/if}
{#if editable}<button class="add" onclick={add}>Add item</button>{/if}

<style>
  ul { list-style: none; margin: 0; padding: 0; }
  li { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0; border-bottom: 1px solid var(--line); font-size: 0.9rem; }
  .qty-read { color: var(--dim); font-variant-numeric: tabular-nums; min-width: 2.2rem; }
  .nm { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  input { background: var(--bg); border: 1px solid var(--line); color: var(--text); border-radius: 4px; padding: 0.2rem 0.35rem; font: inherit; }
  .qty { width: 3.5rem; }
  li input:not(.qty) { flex: 1; min-width: 0; }
  .x { background: none; border: 0; color: var(--dim); cursor: pointer; font-size: 1rem; }
  .x:hover { color: var(--bad); }
  .add { margin-top: 0.6rem; background: none; border: 1px dashed var(--line); color: var(--dim); border-radius: 6px; padding: 0.35rem 0.8rem; font: inherit; font-size: 0.85rem; cursor: pointer; }
  .empty { color: var(--dim); font-size: 0.9rem; }
  input::placeholder { color: var(--dim); opacity: 0.65; }
</style>
