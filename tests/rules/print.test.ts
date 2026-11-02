import { describe, expect, it } from 'vitest';
import { countedForPrint, slotLevel, spellBlocks } from '$lib/rules/print';
import { blankDefinition } from '$lib/sample';
import { emptyState, type Tracker } from '$lib/types';

const tracker = (over: Partial<Tracker>): Tracker => ({
  id: 't', label: '', max: 1, type: 'pips', direction: 'spend', reset: { on: 'long', amount: 'full' }, ...over
});

describe('slotLevel', () => {
  it.each([
    ['1st-level slots', undefined, 1],
    ['Spell Slots · 3rd', undefined, 3],
    ['Pact slots (5th)', undefined, 5],
    ['2nd', 'Spell slots', 2],
    ['Level 4 slots', undefined, 4]
  ])('reads %s', (label, group, level) => {
    expect(slotLevel({ label, group })).toBe(level);
  });

  it('leaves anything that is not a slot alone', () => {
    expect(slotLevel({ label: 'Channel Divinity 2' })).toBeNull();
    expect(slotLevel({ label: 'Risk Dice' })).toBeNull();
    expect(slotLevel({ label: 'Spell slots' })).toBeNull();
  });
});

describe('countedForPrint', () => {
  it('puts slots by level and keeps the rest as resources', () => {
    const def = blankDefinition();
    def.trackers = [
      tracker({ id: 'a', label: '1st-level slots', max: 4 }),
      tracker({ id: 'b', label: '1st', group: 'Pact slots', max: 1 }),
      tracker({ id: 'c', label: 'Second Wind', max: 1, reset: { on: 'short', amount: 'full' } }),
      tracker({ id: 'd', label: 'Broken', max: 'nonsense +' })
    ];
    const state = { ...emptyState(), trackers: { a: 1, b: 9, c: 1 } };
    const { slots, resources } = countedForPrint(def, state);
    // Two trackers at one level add up; spending past the max is clamped.
    expect(slots[1]).toEqual({ max: 5, used: 2 });
    expect(resources.map((r) => [r.label, r.max, r.used, r.reset])).toEqual([
      ['Second Wind', 1, 1, 'Short rest'],
      ['Broken', 0, 0, 'Long rest']
    ]);
  });
});

describe('spellBlocks', () => {
  it('lists cantrips, then levels with spells or slots, then the rest', () => {
    const def = blankDefinition();
    def.spells = [
      { name: 'Fireball', level: '3' },
      { name: 'Light', level: 'Cantrip' },
      { name: 'Odd one', level: 'Ritual' },
      { name: 'Unwritten' }
    ];
    const blocks = spellBlocks(def, { 1: { max: 4, used: 0 } });
    expect(blocks.map((b) => b.title)).toEqual(['Cantrips', 'Level 1', 'Level 3', 'Other']);
    expect(blocks[1].spells).toEqual([]);
    expect(blocks[1].slots).toEqual({ max: 4, used: 0 });
    expect(blocks[3].spells.map((s) => s.name)).toEqual(['Odd one', 'Unwritten']);
  });

  it('is empty for a character with no spells and no slots', () => {
    expect(spellBlocks(blankDefinition(), {})).toEqual([]);
  });
});
