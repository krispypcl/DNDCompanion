<script lang="ts">
  import EditableField from './EditableField.svelte';
  import { modifierOf, saveBonus } from '$lib/rules/derived';
  import { ABILITIES, type Ability, type Definition } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: { definition: Definition; editable: boolean; onchange: (next: Definition) => void } = $props();

  const NAMES: Record<Ability, string> = {
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    wis: 'Wisdom',
    cha: 'Charisma'
  };

  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  function setScore(ability: Ability, score: number) {
    onchange({ ...definition, abilities: { ...definition.abilities, [ability]: score } });
  }

  function toggleSave(ability: Ability) {
    onchange({
      ...definition,
      saves: { ...definition.saves, [ability]: !definition.saves?.[ability] }
    });
  }
</script>

<div class="abilities">
  {#each ABILITIES as ability (ability)}
    <div class="ability" class:prof={definition.saves?.[ability]}>
      <span class="name">{NAMES[ability]}</span>
      <div class="score">
        <EditableField
          value={definition.abilities[ability]}
          {editable}
          type="number"
          label="{NAMES[ability]} score"
          onchange={(v) => setScore(ability, Number(v))}
        />
      </div>
      <span class="mod">{sign(modifierOf(definition, ability))}</span>
      <button
        class="save"
        disabled={!editable}
        aria-pressed={Boolean(definition.saves?.[ability])}
        onclick={() => toggleSave(ability)}
      >
        Save {sign(saveBonus(definition, ability))}
      </button>
    </div>
  {/each}
</div>

<style>
  .abilities {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.6rem;
  }
  .ability {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.55rem 0.65rem;
    background: var(--surface);
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }
  .prof { border-color: var(--accent); }
  .name { font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dim); }
  .score :global(.readout),
  .score :global(input) { font-size: 1.45rem; font-variant-numeric: tabular-nums; }
  .mod { font-size: 1rem; color: var(--accent); font-variant-numeric: tabular-nums; }
  .save {
    margin-top: 0.2rem;
    background: none;
    border: 1px solid var(--line);
    border-radius: 4px;
    color: var(--dim);
    font: inherit;
    font-size: 0.72rem;
    padding: 0.15rem 0.35rem;
    cursor: pointer;
    text-align: left;
  }
  .save[aria-pressed='true'] { color: var(--text); border-color: var(--accent); }
  .save:disabled { cursor: default; }
</style>
