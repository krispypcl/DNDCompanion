<script lang="ts">
  /**
   * A reminder of what any character can do on their turn, for the moment in
   * play when nobody can remember whether Disengage is an action. Collapsed by
   * default, since it is a reference rather than part of the sheet.
   */
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

<details class="actions">
  <summary><span class="cap">General actions</span></summary>
  <!-- A wrapper so browsers without ::details-content still have something to
       animate when the panel opens. -->
  <div class="inner">
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
  </div>
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

  /* Unfolding. Where ::details-content exists the height animates both ways;
     elsewhere the open state is animated and closing snaps, which is the
     direction nobody watches. */
  .actions::details-content {
    block-size: 0;
    opacity: 0;
    overflow: hidden;
    transition:
      block-size 0.32s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.26s ease,
      content-visibility 0.32s allow-discrete;
  }
  .actions[open]::details-content { block-size: auto; opacity: 1; }

  @supports not selector(::details-content) {
    .actions[open] .inner { animation: unfold 0.3s cubic-bezier(0.22, 1, 0.36, 1) both; }
  }
  @keyframes unfold {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: none; }
  }
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
