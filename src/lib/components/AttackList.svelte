<script lang="ts">
  import EntryLink from './EntryLink.svelte';
  import type { Attack, Definition } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: { definition: Definition; editable: boolean; onchange: (next: Definition) => void } = $props();

  function patch(index: number, key: keyof Attack, value: string) {
    const attacks = definition.attacks.map((a, i) => (i === index ? { ...a, [key]: value } : a));
    onchange({ ...definition, attacks });
  }

  function add() {
    onchange({ ...definition, attacks: [...definition.attacks, { name: 'New attack' }] });
  }

  function remove(index: number) {
    onchange({ ...definition, attacks: definition.attacks.filter((_, i) => i !== index) });
  }
</script>

{#if definition.attacks.length === 0 && !editable}
  <p class="empty">No attacks yet.</p>
{:else}
  <div class="scroller">
    <table class:editing={editable}>
      <thead>
        <tr><th>Name</th><th>Hit</th><th>Damage</th><th class="notes">Notes</th>{#if editable}<th></th>{/if}</tr>
      </thead>
      <tbody>
        {#each definition.attacks as attack, i (i)}
          <tr>
            <td class="name">
              {#if editable}
                <input value={attack.name} placeholder="Revolver" aria-label="Attack name" onchange={(e) => patch(i, 'name', e.currentTarget.value)} />
              {:else}
                {attack.name}
              {/if}
              <EntryLink name={attack.name} source={attack.source} category="items" override={attack.lookupUrl} />
              {#if !editable && attack.notes}<span class="note-under">{attack.notes}</span>{/if}
            </td>
            {#each (['bonus', 'damage', 'notes'] as const) as key (key)}
              {@const example = { bonus: '+8', damage: '2d6 + 5', notes: 'Slow mastery, range 30/90' }[key]}
              <td class={key}>
                {#if editable}
                  <input value={attack[key] ?? ''} placeholder={example} aria-label="{attack.name} {key}" onchange={(e) => patch(i, key, e.currentTarget.value)} />
                {:else}
                  {attack[key] ?? '—'}
                {/if}
              </td>
            {/each}
            {#if editable}<td><button class="x" onclick={() => remove(i)} aria-label="Remove {attack.name}">×</button></td>{/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

{#if editable}<button class="add" onclick={add}>Add attack</button>{/if}

<style>
  /* Wide tables scroll inside their own container; the page body never does. */
  .scroller { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; min-width: 30rem; }
  th {
    text-align: left; font-size: 0.65rem; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--dim); font-weight: 500; padding: 0 0.5rem 0.3rem 0; border-bottom: 1px solid var(--line);
  }
  td { padding: 0.35rem 0.5rem 0.35rem 0; border-bottom: 1px solid var(--line); vertical-align: top; }
  .name { font-weight: 600; white-space: nowrap; }
  .bonus, .damage { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .notes { color: var(--dim); font-size: 0.85rem; }
  input { background: var(--bg); border: 1px solid var(--line); color: var(--text); border-radius: 4px; padding: 0.15rem 0.3rem; font: inherit; width: 100%; min-width: 4rem; }
  .x { background: none; border: 0; color: var(--dim); cursor: pointer; font-size: 1rem; padding: 0 0.3rem; }
  .x:hover { color: var(--bad); }
  .add { margin-top: 0.6rem; background: none; border: 1px dashed var(--line); color: var(--dim); border-radius: 6px; padding: 0.35rem 0.8rem; font: inherit; font-size: 0.85rem; cursor: pointer; }
  /* Matches the notes placeholder: body size, --dim. */
  .empty { color: var(--dim); }
  input::placeholder { color: var(--dim); opacity: 0.65; }
  .note-under { display: none; font-size: 0.78rem; color: var(--faint); }
  @media (max-width: 700px) {
    /* Read-only, the notes move under the name. While editing they stay a
       column, because a hidden column cannot be typed into. */
    table:not(.editing) .notes { display: none; }
    table:not(.editing) .note-under { display: block; margin-top: 0.15rem; }
    /* With the notes column gone, the remaining three fit without scrolling —
       but only if the table stops insisting on its desktop width and the
       damage is allowed to wrap. The damage is what you read mid-fight. */
    table:not(.editing) { min-width: 0; }
    table:not(.editing) .name { white-space: normal; }
    table:not(.editing) .damage { white-space: normal; }
  }
</style>
