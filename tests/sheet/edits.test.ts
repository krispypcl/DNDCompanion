import { describe, expect, it } from 'vitest';
import { trackerRows, withClasses, withTrackerRows, withoutTrackers } from '$lib/sheet/edits';
import { slotsByLevel, spellAttack, spellDc } from '$lib/rules/casting';

const def = (over: Record<string, unknown> = {}) => ({
  identity: { name: 'X', level: 5 }, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
  proficiency: 3, combat: { ac: 10, speed: 30, hpMax: 10, hitDice: '1d6' }, saves: {}, skills: {},
  attacks: [], features: [], spells: [], trackers: [], equipment: [], currency: {}, notes: '', ...over
}) as never;

describe('sheet edits', () => {
  it('keeps the single-class fields and the level in step with the classes', () => {
    const next = withClasses(def(), [{ name: 'Wizard', level: 5 }, { name: 'Fighter', level: 2, source: 'xphb' }]) as { identity: Record<string, unknown> };
    expect(next.identity).toMatchObject({ class: 'Wizard', level: 7 });
  });

  it('turns tracker rows back into trackers, keeping what the table does not show', () => {
    const d = def({ trackers: [{ id: 'a', label: 'Ki', description: 'kept', max: 2, type: 'pips', direction: 'spend', reset: { on: 'short', amount: 'full' } }] });
    const rows = trackerRows(d, []);
    rows[0].max = 'classlevel';
    rows[0].cls = 'Monk';
    const next = withTrackerRows(d, rows) as { trackers: Record<string, unknown>[] };
    expect(next.trackers[0]).toMatchObject({ id: 'a', label: 'Ki', description: 'kept', max: 'classlevel', class: 'Monk' });
  });

  it('takes trackers off with what was spent from them', () => {
    const d = def({ trackers: [{ id: 'a' }, { id: 'b' }] });
    const out = withoutTrackers(d, { trackers: { a: 1, b: 2 } } as never, ['a']);
    expect((out.definition as { trackers: { id: string }[] }).trackers.map((t) => t.id)).toEqual(['b']);
    expect((out.state as { trackers: Record<string, number> }).trackers).toEqual({ b: 2 });
  });
});

describe('casting', () => {
  it('sums slots by level and knows how many are left', () => {
    const d = def({
      identity: { name: 'X', level: 5, classes: [{ name: 'Wizard', level: 5 }] },
      trackers: [{ id: 's3', label: '3rd-level slots', max: 'full(3)', class: 'Wizard', type: 'pips', direction: 'spend', reset: { on: 'long', amount: 'full' } }]
    });
    expect(slotsByLevel(d, { trackers: { s3: 1 } } as never).get(3)).toEqual({ max: 2, left: 1, trackers: [{ id: 's3', room: 1 }] });
  });
  it('works out the attack bonus and DC from the casting ability, never as written', () => {
    expect(spellAttack(def({ spellcastingAbility: 'int' }))).toBe(7);
    expect(spellDc(def({ spellcastingAbility: 'int' }))).toBe(15);
    expect(spellAttack(def({ spellcastingAbility: 'int', spellAttackBonus: 9 }))).toBe(7);
    expect(spellDc(def())).toBeNull();
  });
});
