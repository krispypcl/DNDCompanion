import { describe, expect, it } from 'vitest';
import { UNLEVELLED, spellGroupTitle, spellRank } from '$lib/rules/spells';

describe('spell order', () => {
  it('puts cantrips first, then ascending levels, then the unlevelled', () => {
    const levels = ['3', '', 'Cantrip', '1', '10', '2'];
    const sorted = [...levels].sort((a, b) => spellRank(a) - spellRank(b));
    expect(sorted).toEqual(['Cantrip', '1', '2', '3', '10', '']);
  });

  it('reads what was typed, not only what the picker offers', () => {
    expect(spellRank(' cantrip ')).toBe(0);
    expect(spellRank('0')).toBe(0);
    expect(spellRank(' 4 ')).toBe(4);
    expect(spellRank(undefined)).toBe(UNLEVELLED);
    expect(spellRank('one')).toBe(UNLEVELLED);
    expect(spellRank('2.5')).toBe(UNLEVELLED);
  });

  it('names the groups', () => {
    expect(spellGroupTitle(0)).toBe('Cantrips');
    expect(spellGroupTitle(1)).toBe('1st level');
    expect(spellGroupTitle(2)).toBe('2nd level');
    expect(spellGroupTitle(3)).toBe('3rd level');
    expect(spellGroupTitle(4)).toBe('4th level');
    expect(spellGroupTitle(11)).toBe('11th level');
    expect(spellGroupTitle(12)).toBe('12th level');
    expect(spellGroupTitle(21)).toBe('21st level');
    expect(spellGroupTitle(UNLEVELLED)).toBe('No level yet');
  });
});
