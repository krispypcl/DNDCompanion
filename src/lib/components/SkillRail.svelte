<script lang="ts">
  /** Skills grouped under the ability they are scored off, in the same order as
      the ability band, each group headed by that ability's modifier. */
  import { modifierOf, skillTotal } from '$lib/rules/derived';
  import { ABILITIES, SKILLS, type Ability, type Definition, type SkillName } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: { definition: Definition; editable: boolean; onchange: (next: Definition) => void } = $props();

  const NAMES: Record<Ability, string> = {
    str: 'Strength', dex: 'Dexterity', con: 'Constitution',
    int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
  };

  const LABELS: Record<SkillName, string> = {
    acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana',
    athletics: 'Athletics', deception: 'Deception', history: 'History',
    insight: 'Insight', intimidation: 'Intimidation', investigation: 'Investigation',
    medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
    performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
    sleightOfHand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival'
  };

  const grouped: Record<Ability, SkillName[]> = Object.fromEntries(
    ABILITIES.map((ability) => [
      ability,
      (Object.keys(SKILLS) as SkillName[])
        .filter((skill) => SKILLS[skill] === ability)
        .sort((a, b) => LABELS[a].localeCompare(LABELS[b]))
    ])
  ) as Record<Ability, SkillName[]>;

  /** Constitution governs no skill in 5e, so it gets no heading rather than an
      empty one. Driven by the data, not by naming Constitution. */
  const withSkills = ABILITIES.filter((ability) => grouped[ability].length > 0);

  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  /** Cycle: none → proficient → expertise → none. */
  function cycle(skill: SkillName) {
    const current = definition.skills?.[skill] ?? {};
    const next = current.expertise
      ? {}
      : current.proficient
        ? { proficient: true, expertise: true }
        : { proficient: true };
    onchange({ ...definition, skills: { ...definition.skills, [skill]: next } });
  }
</script>

<h2 class="cap">Skills</h2>

{#each withSkills as ability (ability)}
  <section class="group" aria-label="{ability} skills">
    <header>
      <span class="ab">{NAMES[ability]}</span>
      <span class="abmod">{sign(modifierOf(definition, ability))}</span>
    </header>

    {#each grouped[ability] as skill (skill)}
      {@const prof = definition.skills?.[skill]}
      <div class="row" class:prof={prof?.proficient}>
        <button
          class="dot"
          class:on={prof?.proficient}
          class:expert={prof?.expertise}
          disabled={!editable}
          aria-label="{LABELS[skill]} proficiency"
          title={prof?.expertise ? 'Expertise' : prof?.proficient ? 'Proficient' : 'Not proficient'}
          onclick={() => cycle(skill)}
        ></button>
        <span class="name">{LABELS[skill]}</span>
        <span class="bonus">{sign(skillTotal(definition, skill))}</span>
      </div>
    {/each}
  </section>
{/each}

<style>
  .cap {
    font-size: 0.6875rem; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--label); font-weight: 600; margin: 0 0 0.875rem;
  }
  .group { margin-bottom: 0.875rem; }
  .group:last-child { margin-bottom: 0; }
  header {
    display: flex; align-items: baseline; justify-content: space-between;
    padding-bottom: 0.3125rem; margin-bottom: 0.1875rem;
    border-bottom: 1px solid var(--line-soft);
  }
  /* Sentence case and smaller: a group heading, not another section title. */
  .ab {
    font-size: 0.78rem; letter-spacing: 0; text-transform: none;
    color: var(--dim); font-weight: 600;
  }
  .abmod { font-size: 0.6875rem; color: var(--dim); font-variant-numeric: tabular-nums; }
  .row {
    display: flex; align-items: center; gap: 0.5625rem;
    padding: 0.3125rem 0.25rem; margin: 0 -0.25rem; font-size: 0.845rem;
    border-radius: var(--r-sm); transition: background-color 0.15s ease;
  }
  .row:hover { background: var(--hover-bg); }
  .dot {
    width: 0.5625rem; height: 0.5625rem; border-radius: 50%;
    border: 1.5px solid var(--faint); background: none; padding: 0; flex: none; cursor: pointer;
  }
  .dot:disabled { cursor: default; }
  .dot { transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease; }
  .dot:not(:disabled):hover { transform: scale(1.25); }
  /* Half filled for proficiency, filled for expertise: the shape says which,
     without a legend and without colour doing the work on its own. */
  .dot.on {
    border-color: var(--a);
    background-image: linear-gradient(90deg, var(--a) 0 50%, transparent 50% 100%);
  }
  .dot.expert { background-image: none; background-color: var(--a); }
  .name { flex: 1; color: var(--dim); min-width: 0; overflow-wrap: anywhere; line-height: 1.3; }
  .row.prof .name { color: var(--text); font-weight: 600; }
  .bonus {
    font-variant-numeric: tabular-nums; font-size: 0.8125rem; min-width: 2.125rem;
    text-align: center; border: 1px solid var(--line-soft); border-radius: var(--r-sm);
    padding: 0.125rem 0; color: var(--text); font-weight: 600; flex: none;
  }
  .row.prof .bonus { border-color: var(--a-edge); background: var(--a-wash); color: var(--a); }

  /* The dot is 9px across. That is fine to look at and impossible to tap, so
     on a phone it keeps its size and gets a finger-sized hit area around it. */
  @media (max-width: 700px) {
    .dot { position: relative; }
    .dot:not(:disabled)::after {
      content: '';
      position: absolute;
      inset: -0.75rem;
    }
    .row { padding-block: 0.1875rem; }
  }
</style>
