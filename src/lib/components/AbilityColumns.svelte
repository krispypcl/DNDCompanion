<script lang="ts">
  /**
   * Abilities and skills in one grid: each column is an ability card with the
   * skills it governs directly beneath it. The two were separate grids before,
   * which put the skills in alphabetical order and lined them up with nothing.
   *
   * One grid rather than two matched ones is the point — the columns share a
   * track list, so a skill cannot drift away from the ability it is scored off.
   */
  import EditableField from './EditableField.svelte';
  import { modifierOf, passiveScore, saveBonus, skillTotal } from '$lib/rules/derived';
  import { ABILITIES, SKILLS, type Ability, type Definition, type SkillName } from '$lib/types';

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

  const LABELS: Record<SkillName, string> = {
    acrobatics: 'Acrobatics',
    animalHandling: 'Animal Handling',
    arcana: 'Arcana',
    athletics: 'Athletics',
    deception: 'Deception',
    history: 'History',
    insight: 'Insight',
    intimidation: 'Intimidation',
    investigation: 'Investigation',
    medicine: 'Medicine',
    nature: 'Nature',
    perception: 'Perception',
    performance: 'Performance',
    persuasion: 'Persuasion',
    religion: 'Religion',
    sleightOfHand: 'Sleight of Hand',
    stealth: 'Stealth',
    survival: 'Survival'
  };

  const PASSIVES: SkillName[] = ['perception', 'insight', 'investigation'];

  /** Skills grouped under their governing ability, each group alphabetical. */
  const grouped: Record<Ability, SkillName[]> = Object.fromEntries(
    ABILITIES.map((ability) => [
      ability,
      (Object.keys(SKILLS) as SkillName[])
        .filter((skill) => SKILLS[skill] === ability)
        .sort((a, b) => LABELS[a].localeCompare(LABELS[b]))
    ])
  ) as Record<Ability, SkillName[]>;

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

  /** Cycle: none → proficient → expertise → none. */
  function cycleSkill(skill: SkillName) {
    const current = definition.skills?.[skill] ?? {};
    const next = current.expertise
      ? {}
      : current.proficient
        ? { proficient: true, expertise: true }
        : { proficient: true };
    onchange({ ...definition, skills: { ...definition.skills, [skill]: next } });
  }
</script>

<div class="columns">
  {#each ABILITIES as ability (ability)}
    <section class="col" aria-label={NAMES[ability]}>
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

      {#if grouped[ability].length > 0}
        <ul class="skills">
          {#each grouped[ability] as skill (skill)}
            {@const prof = definition.skills?.[skill]}
            <li class:prof={prof?.proficient}>
              <button
                class="dot"
                class:on={prof?.proficient}
                class:expert={prof?.expertise}
                disabled={!editable}
                aria-label="{LABELS[skill]} proficiency"
                onclick={() => cycleSkill(skill)}
              ></button>
              <span class="skill-name">{LABELS[skill]}</span>
              <span class="total">{sign(skillTotal(definition, skill))}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="none">No skills</p>
      {/if}
    </section>
  {/each}
</div>

<div class="passives">
  {#each PASSIVES as skill (skill)}
    <div class="passive">
      <span class="pnum">{passiveScore(definition, skill)}</span>
      <span class="cap">Passive {LABELS[skill]}</span>
    </div>
  {/each}
</div>

<style>
  .columns {
    display: grid;
    /* Six across on a laptop, two or three on a phone. Each column keeps its
       ability card and its own skills together however it reflows. */
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.6rem;
    align-items: start;
  }
  .col { min-width: 0; }
  .ability {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.55rem 0.65rem;
    background: var(--surface);
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }
  .ability.prof { border-color: var(--accent); }
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

  .skills { list-style: none; margin: 0.35rem 0 0; padding: 0 0.15rem; }
  li {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    padding: 0.22rem 0;
    border-bottom: 1px solid var(--line);
    font-size: 0.82rem;
    min-width: 0;
  }
  li:last-child { border-bottom: 0; }
  .dot {
    width: 0.5rem; height: 0.5rem;
    border-radius: 50%;
    border: 1px solid var(--dim);
    background: none;
    padding: 0;
    flex: none;
    cursor: pointer;
  }
  .dot:disabled { cursor: default; }
  .dot.on { background: var(--accent); border-color: var(--accent); }
  .dot.expert { box-shadow: 0 0 0 2px var(--accent); }
  .skill-name {
    flex: 1;
    color: var(--dim);
    min-width: 0;
    /* "Animal Handling" and "Sleight of Hand" must not blow out a column. */
    overflow-wrap: anywhere;
    line-height: 1.25;
  }
  li.prof .skill-name { color: var(--text); font-weight: 600; }
  .total { font-variant-numeric: tabular-nums; flex: none; }
  li.prof .total { color: var(--accent); }
  .none { margin: 0.5rem 0 0; padding: 0 0.15rem; font-size: 0.75rem; color: var(--dim); opacity: 0.7; }

  .passives { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-top: 1.25rem; }
  .passive {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    background: var(--surface);
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
  }
  .pnum { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
  .cap { font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
</style>
