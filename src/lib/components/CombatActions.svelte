<script lang="ts">
  /**
   * A reminder of what any character can do on their turn, for the moment in
   * play when nobody can remember whether Disengage is an action. Collapsed by
   * default, since it is a reference rather than part of the sheet.
   */
  import { actionsOpen } from '$lib/stores/tray';
  import Fold from './Fold.svelte';
  import InfoTip from './InfoTip.svelte';

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
      note: 'You only have a bonus action when a feature, spell or item grants one.',
      items: ['Off-hand attack', 'Class feature', 'A spell cast as a bonus action']
    },
    {
      label: 'Reaction',
      items: ['Opportunity attack', 'A readied trigger', 'A spell cast as a reaction']
    },
    {
      label: 'Table variants',
      note: 'Optional rules from the Dungeon Master’s Guide. Check with your DM before using them.',
      items: ['Overrun', 'Tumble', 'Climb onto a bigger creature', 'Disarm']
    }
  ];
</script>

<Fold label="General actions" bind:open={$actionsOpen}>
  {#each GROUPS as group (group.label)}
    <section>
      <div class="head">
        <h3>{group.label}</h3>
        {#if group.note}<InfoTip label="About {group.label.toLowerCase()}">{group.note}</InfoTip>{/if}
      </div>
      <ul>
        {#each group.items as item (item)}<li>{item}</li>{/each}
      </ul>
    </section>
  {/each}
</Fold>

<style>
  section { margin-top: 0.875rem; }
  h3 {
    margin: 0;
    font-size: 0.5875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dim);
    font-weight: 600;
  }
  /* One height whether or not there is an (i): the button overhangs the line
     rather than pushing the chips below it down. */
  .head { display: flex; align-items: center; gap: 0.125rem; height: 1rem; }
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
