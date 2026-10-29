import { describe, expect, it, test } from 'vitest';
import {
  abilityModifier,
  formulaContext,
  passiveScore,
  saveBonus,
  skillTotal,
  spellAttackBonus,
  characterLevel,
  classLevels,
  classLine,
  classList,
  spellSaveDC,
  weightCarried
} from '$lib/rules/derived';
import { trackerMax } from '$lib/rules/tracker';
import type { Definition } from '$lib/types';

/** Loka Sibbs at level 5, taken from the real sheet. */
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

describe('abilityModifier', () => {
  test.each([
    [18, 4],
    [9, -1],
    [10, 0],
    [11, 0],
    [1, -5],
    [30, 10]
  ])('score %i gives modifier %i', (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });
});

describe('saveBonus', () => {
  test('a proficient save adds the proficiency bonus', () => {
    expect(saveBonus(loka, 'dex')).toBe(7);
    expect(saveBonus(loka, 'cha')).toBe(7);
  });

  test('a non-proficient save is just the modifier', () => {
    expect(saveBonus(loka, 'con')).toBe(3);
    expect(saveBonus(loka, 'int')).toBe(-1);
  });
});

describe('skillTotal', () => {
  test('a proficient skill adds the proficiency bonus', () => {
    expect(skillTotal(loka, 'stealth')).toBe(7);
    expect(skillTotal(loka, 'deception')).toBe(7);
  });

  test('a non-proficient skill is just the modifier', () => {
    expect(skillTotal(loka, 'perception')).toBe(2);
  });

  test('expertise doubles the proficiency bonus', () => {
    const expert: Definition = {
      ...loka,
      skills: { ...loka.skills, stealth: { proficient: true, expertise: true } }
    };
    expect(skillTotal(expert, 'stealth')).toBe(10);
  });
});

describe('passiveScore', () => {
  test('is ten plus the skill total', () => {
    expect(passiveScore(loka, 'perception')).toBe(12);
    expect(passiveScore(loka, 'insight')).toBe(12);
    expect(passiveScore(loka, 'investigation')).toBe(9);
  });
});

describe('spell numbers', () => {
  test('save DC is 8 plus proficiency plus the modifier', () => {
    expect(spellSaveDC(loka, 'cha')).toBe(15);
  });

  test('attack bonus is proficiency plus the modifier', () => {
    expect(spellAttackBonus(loka, 'cha')).toBe(7);
  });
});

describe('formulaContext', () => {
  test('exposes level, proficiency and ability modifiers', () => {
    expect(formulaContext(loka)).toEqual({
      level: 5,
      // Defaults to the total; trackerMax narrows it to the tracker's class.
      classlevel: 5,
      classLevels: { gunslinger: 5 },
      prof: 3,
      str: 1,
      dex: 4,
      con: 3,
      int: -1,
      wis: 2,
      cha: 4
    });
  });
});

describe('weight carried', () => {
  const withGear = (equipment: Definition['equipment']): Definition =>
    ({ ...loka, equipment }) as Definition;

  it('counts an item once per unit in the stack', () => {
    expect(weightCarried(withGear([{ name: 'Revolver', qty: 2, weight: 3 }]))).toBe(6);
  });

  it('treats a missing quantity as one', () => {
    expect(weightCarried(withGear([{ name: 'Rope', weight: 10 }]))).toBe(10);
  });

  it('skips an item with no weight rather than failing the sum', () => {
    const total = weightCarried(
      withGear([
        { name: 'Revolver', qty: 2, weight: 3 },
        { name: 'Tinderbox', qty: 1 },
        { name: "Sheriff's Star", qty: 1, weight: 0.5 }
      ])
    );
    expect(total).toBe(6.5);
  });

  it('is zero for an empty pack', () => {
    expect(weightCarried(withGear([]))).toBe(0);
  });

  it('does not leak floating point noise', () => {
    expect(weightCarried(withGear([{ name: 'a', weight: 0.1 }, { name: 'b', weight: 0.2 }]))).toBe(0.3);
  });
});

describe('classes and levels', () => {
  const single = { ...loka, identity: { ...loka.identity, class: 'Gunslinger', subclass: 'White Hat', level: 5 } } as Definition;
  const multi = {
    ...loka,
    identity: {
      ...loka.identity,
      classes: [
        { name: 'Gunslinger', subclass: 'White Hat', level: 5 },
        { name: 'Fighter', level: 2 }
      ]
    }
  } as Definition;

  it('reads a sheet written before multiclassing as one class', () => {
    expect(classList(single)).toEqual([
      { name: 'Gunslinger', subclass: 'White Hat', level: 5 }
    ]);
    expect(characterLevel(single)).toBe(5);
  });

  it('sums levels across classes', () => {
    expect(characterLevel(multi)).toBe(7);
  });

  it('reads a single class the way a player says it', () => {
    expect(classLine(single)).toBe('White Hat Gunslinger');
  });

  it('reads a multiclass with the levels that matter', () => {
    expect(classLine(multi)).toBe('Gunslinger 5 / Fighter 2');
  });

  it('keys class levels by name, case-insensitively', () => {
    expect(classLevels(multi)).toEqual({ gunslinger: 5, fighter: 2 });
  });
});

describe('classlevel in a tracker formula', () => {
  const multi = {
    ...loka,
    identity: {
      ...loka.identity,
      classes: [
        { name: 'Gunslinger', level: 5 },
        { name: 'Fighter', level: 2 }
      ]
    }
  } as Definition;
  const ctx = formulaContext(multi);
  const tracker = (over: Record<string, unknown> = {}) =>
    ({ id: 't', label: 'T', max: 'classlevel', type: 'pips', direction: 'spend',
       reset: { on: 'short', amount: 'full' }, ...over }) as never;

  // The whole point: a class feature must not inflate when you multiclass.
  it('scopes classlevel to the tracker own class', () => {
    expect(trackerMax(tracker({ class: 'Gunslinger' }), ctx)).toBe(5);
    expect(trackerMax(tracker({ class: 'fighter' }), ctx)).toBe(2);
  });

  it('falls back to the character total when the tracker names no class', () => {
    expect(trackerMax(tracker(), ctx)).toBe(7);
  });

  it('reads a class the character does not have as zero, not as the total', () => {
    expect(trackerMax(tracker({ class: 'Druid' }), ctx)).toBe(0);
  });

  it('still treats level as the character total', () => {
    expect(trackerMax(tracker({ max: 'level', class: 'Gunslinger' }), ctx)).toBe(7);
  });
});
