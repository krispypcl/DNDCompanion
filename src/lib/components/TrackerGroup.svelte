<script lang="ts">
  import Tracker from './Tracker.svelte';
  import type { FormulaContext } from '$lib/rules/formula';
  import type { Tracker as TrackerT } from '$lib/types';

  let {
    trackers,
    spent,
    ctx,
    editable,
    refilling = false,
    onchange
  }: {
    trackers: TrackerT[];
    spent: Record<string, number>;
    ctx: FormulaContext;
    editable: boolean;
    refilling?: boolean;
    onchange: (id: string, value: number) => void;
  } = $props();

  /** Trackers sharing a `group` render as one block; the rest stand alone. */
  const groups = $derived.by(() => {
    const map = new Map<string, TrackerT[]>();
    for (const t of trackers) {
      const key = t.group ?? `\u0000${t.id}`;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return [...map.entries()].map(([key, items]) => ({
      name: key.startsWith('\u0000') ? null : key,
      items
    }));
  });
</script>

{#each groups as group (group.name ?? group.items[0].id)}
  {#if group.name}
    <section class="group">
      <h3>{group.name}</h3>
      <div class="grid">
        {#each group.items as t (t.id)}
          <Tracker
            tracker={t}
            spent={spent[t.id] ?? 0}
            {ctx}
            {editable}
            {refilling}
            onchange={(v) => onchange(t.id, v)}
          />
        {/each}
      </div>
    </section>
  {:else}
    {#each group.items as t (t.id)}
      <Tracker
        tracker={t}
        spent={spent[t.id] ?? 0}
        {ctx}
        {editable}
        {refilling}
        onchange={(v) => onchange(t.id, v)}
      />
    {/each}
  {/if}
{/each}

<style>
  .group {
    grid-column: 1 / -1;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.6rem 0.75rem 0.75rem;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.7rem;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 600;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
    gap: 0.5rem;
  }
</style>
