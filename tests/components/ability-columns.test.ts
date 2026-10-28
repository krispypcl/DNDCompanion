/**
 * Abilities and skills share one grid, so a skill must sit inside the column of
 * the ability it is scored off. Asserting the DOM nesting is what makes the
 * visual alignment a guarantee rather than a coincidence of two grids.
 */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import AbilityColumns from '$lib/components/AbilityColumns.svelte';
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

const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

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
  render(AbilityColumns, { props: { definition: loka, editable, onchange } });

describe('AbilityColumns', () => {
  it('puts every skill in the column of the ability it is scored off', () => {
    mount();
    for (const [skill, ability] of Object.entries(SKILLS) as [SkillName, Ability][]) {
      const column = screen.getByLabelText(ABILITY_NAMES[ability]);
      const names = Array.from(column.querySelectorAll('li .skill-name')).map((n) =>
        n.textContent?.trim()
      );
      expect(names, `${skill} must sit under ${ABILITY_NAMES[ability]}`).toContain(LABELS[skill]);
    }
  });

  it('shows each skill once in the whole grid, not once per column', () => {
    const { container } = mount();
    const all = Array.from(container.querySelectorAll('li .skill-name')).map((n) =>
      n.textContent?.trim()
    );
    expect(all).toHaveLength(Object.keys(SKILLS).length);
    expect(new Set(all).size).toBe(all.length);
  });

  it('lists each ability column exactly once', () => {
    mount();
    for (const name of Object.values(ABILITY_NAMES)) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
  });

  it('orders skills alphabetically within a column', () => {
    mount();
    const wis = screen.getByLabelText('Wisdom');
    const names = Array.from(wis.querySelectorAll('.skill-name')).map((n) => n.textContent?.trim());
    expect(names).toEqual(['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival']);
  });

  it('says so rather than leaving a gap where an ability governs no skills', () => {
    mount();
    const con = screen.getByLabelText('Constitution');
    expect(con.querySelectorAll('.skill-name')).toHaveLength(0);
    expect(con.textContent).toContain('No skills');
  });

  it('still shows the derived numbers it did before', () => {
    const { container } = mount();
    const text = container.textContent ?? '';
    expect(text).toContain('Dexterity');
    expect(text).toContain('+4'); // DEX 18
    expect(text).toContain('Save +7'); // proficient: 4 + 3
    expect(text).toContain('Save +3'); // CON, not proficient
    expect(text).toContain('+7'); // Stealth: DEX 4 + prof 3
    expect(text).toContain('12'); // passive Perception: 10 + 2
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
