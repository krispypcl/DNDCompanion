<script lang="ts">
  import { passiveScore, skillTotal } from '$lib/rules/derived';
  import { SKILLS, type Definition, type SkillName } from '$lib/types';

  let {
    definition,
    editable,
    onchange
  }: { definition: Definition; editable: boolean; onchange: (next: Definition) => void } = $props();

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

  const names = Object.keys(SKILLS) as SkillName[];
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

<div class="passives">
  {#each (['perception', 'insight', 'investigation'] as SkillName[]) as skill (skill)}
    <div class="passive">
      <span class="num">{passiveScore(definition, skill)}</span>
      <span class="cap">Passive {LABELS[skill]}</span>
    </div>
  {/each}
</div>

<ul class="skills">
  {#each names as skill (skill)}
    {@const prof = definition.skills?.[skill]}
    <li class:prof={prof?.proficient}>
      <button
        class="dot"
        class:on={prof?.proficient}
        class:expert={prof?.expertise}
        disabled={!editable}
        aria-label="{LABELS[skill]} proficiency"
        onclick={() => cycle(skill)}
      ></button>
      <span class="name">{LABELS[skill]}</span>
      <span class="abil">{SKILLS[skill]}</span>
      <span class="total">{sign(skillTotal(definition, skill))}</span>
    </li>
  {/each}
</ul>

<style>
  .passives { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .passive {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    background: var(--surface);
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
  }
  .num { font-size: 1.15rem; font-variant-numeric: tabular-nums; }
  .cap { font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--dim); }
  .skills {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
    gap: 0 1.25rem;
  }
  li {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--line);
    font-size: 0.9rem;
    min-width: 0;
  }
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
  .name { flex: 1; color: var(--dim); min-width: 0; }
  .prof .name { color: var(--text); font-weight: 600; }
  .abil { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--dim); }
  .total { font-variant-numeric: tabular-nums; width: 2.2rem; text-align: right; }
  .prof .total { color: var(--accent); }
</style>
