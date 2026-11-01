import { describe, expect, it } from 'vitest';
import { CUSTOM, UNLEVELLED, spellGroup, spellLevel, spellRank } from '$lib/rules/spells';

describe('spell types', () => {
  it('reads a level however it was written', () => {
    for (const t of ['3', ' 3 ', '3rd level', '3rd-level', '3rd level spell', 'Level 3', 'lvl 3', '3 level']) {
      expect(spellLevel(t), t).toBe(3);
    }
    expect(spellLevel('Cantrip')).toBe(0);
    expect(spellLevel('cantrips')).toBe(0);
    expect(spellLevel('0')).toBe(0);
    expect(spellLevel('Ritual')).toBeNull();
    expect(spellLevel('2.5')).toBeNull();
  });

  it('orders cantrips, levels, the player’s own types, then the untyped', () => {
    const types = ['Ritual', '3', '', 'Cantrip', '1st level', '10', 'Innate'];
    const sorted = [...types].sort((a, b) => spellRank(a) - spellRank(b));
    expect(sorted.slice(0, 4)).toEqual(['Cantrip', '1st level', '3', '10']);
    expect(spellRank('Ritual')).toBe(CUSTOM);
    expect(spellRank('')).toBe(UNLEVELLED);
  });

  it('names the groups, folding case for the player’s own', () => {
    expect(spellGroup('Cantrip')).toBe('Cantrips');
    expect(spellGroup('2')).toBe('2nd level');
    expect(spellGroup('11')).toBe('11th level');
    expect(spellGroup('ritual')).toBe('Ritual');
    expect(spellGroup('RITUAL')).toBe('Ritual');
    expect(spellGroup('')).toBe('No level yet');
  });

});
