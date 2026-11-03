<script lang="ts">
  import Tracker from './Tracker.svelte';
  import type { FormulaContext } from '$lib/rules/formula';
  import type { Tracker as TrackerT } from '$lib/types';
  import { trackerMax } from '$lib/rules/tracker';
  import { slotLevel } from '$lib/rules/print';

  let {
    trackers,
    spent,
    ctx,
    editable,
    refilling = false,
    onchange,
    onroll,
    classes = []
  }: {
    classes?: { name: string; source?: string }[];
    trackers: TrackerT[];
    spent: Record<string, number>;
    ctx: FormulaContext;
    editable: boolean;
    refilling?: boolean;
    onchange: (id: string, value: number) => void;
    /** Rolls a tracker's die, after asking. */
    onroll?: (t: TrackerT) => void;
  } = $props();

  /**
   * Spell slots of a level the character has not reached (9th-level slots
   * for a 3rd-level wizard) are not shown until they have some. Any other
   * tracker shows even at 0: it may simply be spent, or a score may be low.
   */
  function reached(t: TrackerT): boolean {
    if (slotLevel(t) === null) return true;
    try {
      return trackerMax(t, ctx) > 0;
    } catch {
      return true;
    }
  }

  /** Trackers sharing a `group` render as one block; the rest stand alone. */
  const groups = $derived.by(() => {
    const map = new Map<string, TrackerT[]>();
    for (const t of trackers.filter(reached)) {
      const key = t.group ?? `\u0000${t.id}`;
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return [...map.entries()].map(([key, items]) => ({
      name: key.startsWith('\u0000') ? null : key,
      items
    }));
  });
</script>

<!-- On a rest, trackers refill one after another, top to bottom. -->
<div class="stack">
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
            stagger={trackers.findIndex((x) => x.id === t.id)}
            onchange={(v) => onchange(t.id, v)}
            onroll={onroll ? () => onroll(t) : undefined}
            {classes}
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
        stagger={trackers.findIndex((x) => x.id === t.id)}
        onchange={(v) => onchange(t.id, v)}
        onroll={onroll ? () => onroll(t) : undefined}
            {classes}
      />
    {/each}
  {/if}
{/each}
</div>

<style>
  /* Standalone trackers are siblings in the rail, so the gap lives here. */
  .stack { display: grid; gap: 0.625rem; }
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
