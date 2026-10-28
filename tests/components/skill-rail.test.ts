/**
 * Abilities and skills share one grid, so a skill must sit inside the column of
 * the ability it is scored off. Asserting the DOM nesting is what makes the
 * visual alignment a guarantee rather than a coincidence of two grids.
 */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import SkillRail from '$lib/components/SkillRail.svelte';
import { SKILLS, type Ability, type Definition, type SkillName } from '$lib/types';

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

/** Groups are labelled "<ability> skills" so a skill can be traced to its group. */
const groupLabel = (ability: Ability) => `${ability} skills`;

const loka: Definition = {
  identity: { name: 'Loka Sibbs', class: 'Gunslinger', level: 5 },
  abilities: { str: 12, dex: 18, con: 16, int: 9, wis: 14, cha: 18 },
  proficiency: 3,
  combat: { ac: 16, speed: 30, hpMax: 40, hitDice: '5d8' },
  saves: { dex: true, cha: true },
  skills: {
    acrobatics: { proficient: true },
    deception: { proficient: true },
    sleightOfHand: { proficient: true },
    stealth: { proficient: true }
  },
  attacks: [],
  features: [],
  spells: [],
  trackers: [],
  equipment: [],
  currency: {},
  notes: ''
};

const mount = (editable = false, onchange: (next: Definition) => void = () => {}) =>
  render(SkillRail, { props: { definition: loka, editable, onchange } });

describe('AbilityColumns', () => {
  it('puts every skill in the group of the ability it is scored off', () => {
    mount();
    for (const [skill, ability] of Object.entries(SKILLS) as [SkillName, Ability][]) {
      const group = screen.getByLabelText(groupLabel(ability));
      const names = Array.from(group.querySelectorAll('.row .name')).map((n) =>
        n.textContent?.trim()
      );
      expect(names, `${skill} must sit under ${ability}`).toContain(LABELS[skill]);
    }
  });

  it('shows each skill once in the whole rail, not once per group', () => {
    const { container } = mount();
    const all = Array.from(container.querySelectorAll('.row .name')).map((n) =>
      n.textContent?.trim()
    );
    expect(all).toHaveLength(Object.keys(SKILLS).length);
    expect(new Set(all).size).toBe(all.length);
  });

  it('lists each ability group exactly once, in ability order', () => {
    const { container } = mount();
    const headings = Array.from(container.querySelectorAll('.group .ab')).map((n) =>
      n.textContent?.trim()
    );
    expect(headings).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
  });

  it('orders skills alphabetically within a group', () => {
    mount();
    const wis = screen.getByLabelText(groupLabel('wis'));
    const names = Array.from(wis.querySelectorAll('.name')).map((n) => n.textContent?.trim());
    expect(names).toEqual(['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival']);
  });

  it('says so rather than leaving a gap where an ability governs no skills', () => {
    mount();
    const con = screen.getByLabelText(groupLabel('con'));
    expect(con.querySelectorAll('.row .name')).toHaveLength(0);
    expect(con.textContent).toContain('No skills');
  });

  it('shows the group modifier and each skill total', () => {
    const { container } = mount();
    const text = container.textContent ?? '';
    expect(text).toContain('+4'); // DEX modifier, on the group heading
    expect(text).toContain('+7'); // Stealth: DEX 4 + prof 3
    expect(text).toContain('-1'); // INT 9
  });

  it('cycles a skill none → proficient and reports it', () => {
    const onchange = vi.fn();
    mount(true, onchange);
    (screen.getByLabelText('Athletics proficiency') as HTMLButtonElement).click();
    const next = onchange.mock.calls.at(-1)![0] as Definition;
    expect(next.skills.athletics).toEqual({ proficient: true });
  });

  it('gives a viewer no working controls', () => {
    mount(false);
    for (const b of screen.queryAllByRole('button')) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
