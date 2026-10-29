<script lang="ts">
  /**
   * A reminder of what any character can do on their turn, for the moment in
   * play when nobody can remember whether Disengage is an action. Collapsed by
   * default, since it is a reference rather than part of the sheet.
   */
  const GROUPS: { label: string; note?: string; items: string[] }[] = [
    {
      label: 'Action',
      items: [
        'Attack',
        'Dash',
        'Disengage',
        'Dodge',
        'Help',
        'Hide',
        'Ready',
        'Search',
        'Grapple',
        'Shove',
        'Use an object',
        'Cast a spell'
      ]
    },
    {
      label: 'Bonus action',
      note: 'Only when something grants one',
      items: ['Off-hand attack', 'Class feature', 'A spell cast as a bonus action']
    },
    {
      label: 'Reaction',
      items: ['Opportunity attack', 'A readied trigger', 'A spell cast as a reaction']
    },
    {
      label: 'Table variants',
      note: 'Optional rules — check with your DM',
      items: ['Overrun', 'Tumble', 'Climb onto a bigger creature', 'Disarm']
    }
  ];
</script>

<details class="actions">
  <summary><span class="cap">General actions</span></summary>
  {#each GROUPS as group (group.label)}
    <section>
      <h3>{group.label}</h3>
      {#if group.note}<p class="note">{group.note}</p>{/if}
      <ul>
        {#each group.items as item (item)}<li>{item}</li>{/each}
      </ul>
    </section>
  {/each}
</details>

<style>
  .actions { padding-top: 1.25rem; }
  summary {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  summary::-webkit-details-marker { display: none; }
  summary::after {
    content: '';
    width: 0.4rem;
    height: 0.4rem;
    border-right: 1.5px solid var(--dim);
    border-bottom: 1.5px solid var(--dim);
    transform: rotate(45deg) translateY(-1px);
    transition: transform 0.2s ease;
  }
  details[open] summary::after { transform: rotate(-135deg) translateY(-1px); }
  .cap {
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--label);
    font-weight: 600;
  }
  section { margin-top: 0.875rem; }
  h3 {
    margin: 0;
    font-size: 0.5875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 600;
  }
  .note { margin: 0.125rem 0 0; font-size: 0.7rem; color: var(--faint); }
  ul {
    list-style: none;
    margin: 0.3125rem 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.375rem;
  }
  li {
    font-size: 0.75rem;
    color: var(--dim);
    background: var(--raised);
    border: 1px solid var(--line-soft);
    border-radius: var(--r-sm);
    padding: 0.125rem 0.4375rem;
  }
</style>
