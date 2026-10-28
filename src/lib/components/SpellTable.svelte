<script lang="ts">
  import EntryLink from './EntryLink.svelte';
  import type { Definition } from '$lib/types';

  let { definition }: { definition: Definition } = $props();

  const COLUMNS = ['save', 'time', 'range', 'components', 'duration', 'notes'] as const;
  const HEADS = ['Save/Atk', 'Time', 'Range', 'Comp', 'Duration', 'Notes'];
</script>

{#if (definition.spells ?? []).length === 0}
  <p class="empty">No spells or abilities recorded.</p>
{:else}
  <div class="scroller">
    <table>
      <thead>
        <tr><th>Name</th>{#each HEADS as head (head)}<th>{head}</th>{/each}</tr>
      </thead>
      <tbody>
        {#each definition.spells as spell, i (i)}
          <tr>
            <td class="name">
              {spell.name}
              <EntryLink name={spell.name} source={spell.source} category="spells" override={spell.lookupUrl} />
            </td>
            {#each COLUMNS as key (key)}
              <td class={key}>{spell[key] ?? '—'}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .scroller { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; min-width: 40rem; }
  th {
    text-align: left; font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--dim); font-weight: 500; padding: 0 0.6rem 0.3rem 0; border-bottom: 1px solid var(--line);
  }
  td { padding: 0.4rem 0.6rem 0.4rem 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  .name { font-weight: 600; white-space: nowrap; }
  .notes { color: var(--dim); font-size: 0.82rem; }
  /* Matches the notes placeholder: body size, --dim. */
  .empty { color: var(--dim); }
</style>
