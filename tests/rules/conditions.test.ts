import { describe, expect, it } from 'vitest';
import {
  STANDARD_CONDITIONS,
  addCondition,
  conditionUrl,
  hasCondition,
  removeCondition
} from '$lib/rules/conditions';
import { emptyState } from '$lib/types';

describe('conditions', () => {
  it('adds a name, trimmed and with its spaces squeezed', () => {
    const next = addCondition(emptyState(), '  Hunter’s   Mark ');
    expect(next.conditions).toEqual(['Hunter’s Mark']);
  });

  it('ignores a blank name and returns the same state', () => {
    const s = emptyState();
    expect(addCondition(s, '   ')).toBe(s);
  });

  it('does not add the same one twice, whatever the case', () => {
    const once = addCondition(emptyState(), 'Prone');
    expect(addCondition(once, 'prone')).toBe(once);
    expect(hasCondition(once, ' PRONE ')).toBe(true);
  });

  it('removes by name and leaves the rest in order', () => {
    let s = emptyState();
    for (const c of ['Prone', 'Bless', 'Poisoned']) s = addCondition(s, c);
    expect(removeCondition(s, 'bless').conditions).toEqual(['Prone', 'Poisoned']);
  });

  it('copes with a sheet saved before the field existed', () => {
    const old = { ...emptyState(), conditions: undefined } as unknown as ReturnType<typeof emptyState>;
    expect(addCondition(old, 'Prone').conditions).toEqual(['Prone']);
    expect(removeCondition(old, 'Prone').conditions).toEqual([]);
  });

  it('does not touch the state it was given', () => {
    const s = emptyState();
    addCondition(s, 'Prone');
    expect(s.conditions).toEqual([]);
  });

  it('links a standard condition, with or without a level, and nothing else', () => {
    expect(conditionUrl('Poisoned')).toBe('https://5e.tools/conditionsdiseases.html#poisoned_xphb');
    expect(conditionUrl('Exhaustion 3')).toBe('https://5e.tools/conditionsdiseases.html#exhaustion_xphb');
    expect(conditionUrl('Bless')).toBeNull();
    // The fifteen in the rules, and Dead, which has no page to link to.
    expect(STANDARD_CONDITIONS).toHaveLength(16);
    expect(conditionUrl('Dead')).toBeNull();
  });
});
