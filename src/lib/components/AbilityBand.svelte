<script lang="ts">
  /** Abilities and saving throws. The modifier is the hero number and the
      score sits under it, because the modifier is what you use every round. */
  import EditableField from './EditableField.svelte';
  import { modifierOf, saveBonus, saveExtra } from '$lib/rules/derived';
  import { ABILITIES, type Ability, type Definition } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: { definition: Definition; editable: boolean; onchange: (next: Definition) => void } = $props();

  const NAMES: Record<Ability, string> = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
  };

  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  function setScore(ability: Ability, score: number) {
    onchange({ ...definition, abilities: { ...definition.abilities, [ability]: score } });
  }

  function breakdown(ability: Ability) {
    const extra = saveExtra(definition, ability);
    const parts = [`${NAMES[ability]} modifier`];
    if (definition.saves?.[ability]) parts.push('proficiency');
    if (extra !== 0) parts.push(`bonus ${sign(extra)}`);
    return parts.join(' + ');
  }

  /** An empty field clears the bonus rather than writing a zero. */
  function setBonus(ability: Ability, raw: number | string) {
    const next = { ...(definition.saveBonuses ?? {}) };
    if (raw === '' || Number.isNaN(Number(raw))) delete next[ability];
    else next[ability] = Number(raw);
    onchange({ ...definition, saveBonuses: next });
  }

  function toggleSave(ability: Ability) {
    onchange({
      ...definition,
      saves: { ...definition.saves, [ability]: !definition.saves?.[ability] }
    });
  }
</script>

<span class="cap">Abilities &amp; saving throws</span>
<div class="abilities">
  {#each ABILITIES as ability (ability)}
    <div class="ability">
      <span class="name">{NAMES[ability]}</span>
      <span class="mod">{sign(modifierOf(definition, ability))}</span>
      <span class="score">
        <EditableField
          value={definition.abilities[ability]}
          {editable}
          type="number"
          label="{NAMES[ability]} score"
          onchange={(v) => setScore(ability, Number(v))}
        />
      </span>
    </div>
  {/each}
</div>

<div class="saves">
  {#each ABILITIES as ability (ability)}
    <div class="save" class:on={definition.saves?.[ability]}>
      <button
        class="toggle"
        disabled={!editable}
        aria-pressed={Boolean(definition.saves?.[ability])}
        aria-label="{NAMES[ability]} saving throw proficiency"
        title={breakdown(ability)}
        onclick={() => toggleSave(ability)}
      >
        <b>{sign(saveBonus(definition, ability))}</b>
      </button>
      <!-- A flat bonus from an item or aura. Always rendered, so entering edit
           mode does not move the band. -->
      <span class="bonus">
        <EditableField
          value={definition.saveBonuses?.[ability] ?? ''}
          {editable}
          type="number"
          display={saveExtra(definition, ability) !== 0
            ? sign(saveExtra(definition, ability))
            : '—'}
          label="{NAMES[ability]} saving throw bonus"
          onchange={(v) => setBonus(ability, v)}
        />
      </span>
    </div>
  {/each}
</div>

<style>
  .cap {
    display: block;
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600;
  }
  .abilities, .saves { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.625rem; }
  .abilities { margin-top: 0.625rem; }
  .saves { margin-top: 0.625rem; }
  .ability {
    background: var(--raised); border: 1px solid var(--line);
    border-radius: var(--r); padding: 0.625rem 0.5rem 0.5rem; text-align: center; min-width: 0;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }
  .ability:hover { border-color: var(--hover-line); background: var(--hover-bg); }
  .name {
    display: block; font-size: 0.78rem; letter-spacing: 0;
    text-transform: none; color: var(--dim); font-weight: 600;
  }
  .mod {
    display: block; font-size: 1.625rem; font-weight: 600; line-height: 1;
    color: var(--a-hi); font-variant-numeric: tabular-nums; margin-top: 0.3125rem;
  }
  /* The score sits under the modifier, the way a sheet prints it. */
  .score { display: block; margin-top: 0.3125rem; }
  .score :global(.field) {
    /* Override the variables rather than the padding directly, so the derived
       height stays in step with it. */
    --fld-leading: 1.4; --fld-pad-y: 0px;
    field-sizing: fixed; display: block; width: 2.75rem; margin-inline: auto;
    font-size: 0.75rem; color: var(--dim); font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .save {
    background: var(--raised); border: 1px solid var(--line-soft);
    border-radius: var(--r-sm); padding: 0.375rem 0.25rem 0.3125rem;
    text-align: center; min-width: 0;
    transition: border-color 0.2s ease, background-color 0.2s ease;
  }
  .save:not(.on):hover { border-color: var(--hover-line); background: var(--hover-bg); }
  .save.on { border-color: var(--a-edge); background: var(--a-wash); }
  .toggle {
    display: block; width: 100%; padding: 0; border: 0; background: none;
    font: inherit; color: inherit; cursor: pointer;
  }
  .toggle:disabled { cursor: default; }
  .save b { display: block; font-size: 1rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .save.on b { color: var(--a); }
  /* The written bonus, kept quiet: the total above it is the number in play. */
  .bonus { display: block; margin-top: 0.1875rem; }
  .bonus :global(.field) {
    --fld-leading: 1.4; --fld-pad-y: 0px;
    field-sizing: fixed; display: block; width: 2.75rem; margin-inline: auto;
    font-size: 0.75rem; color: var(--dim); font-variant-numeric: tabular-nums;
    text-align: center;
  }


  @media (max-width: 860px) {
    .abilities, .saves { grid-template-columns: repeat(3, 1fr); }
  }
</style>
