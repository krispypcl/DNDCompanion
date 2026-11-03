import { describe, expect, it } from 'vitest';
import { cantripTier, spellDamage, splitUpcast } from '$lib/rules/spellroll';

describe('spell rolls', () => {
  it('reads what a spell gains per level', () => {
    expect(splitUpcast('8d6 fire +1d6/level').per).toEqual({ dice: { 6: 1 }, modifier: 0, mode: 'normal' });
    expect(splitUpcast('3d4+3 + 1d4+1 per slot level').per).toEqual({ dice: { 4: 1 }, modifier: 1, mode: 'normal' });
    expect(splitUpcast('1d10 fire').per).toBeNull();
  });

  it('adds the dice for each level above the spell’s own', () => {
    expect(spellDamage('8d6 fire +1d6/level', 3, 3, 5)?.dice).toEqual({ 6: 8 });
    expect(spellDamage('8d6 fire +1d6/level', 3, 5, 5)?.dice).toEqual({ 6: 10 });
    expect(spellDamage('3d4+3 +1d4+1/lvl', 1, 3, 5)).toEqual({ dice: { 4: 5 }, modifier: 5, mode: 'normal' });
    // Without a level written above its own, it is the base roll.
    expect(spellDamage('8d6 +1d6/level', 3, null, 5)?.dice).toEqual({ 6: 8 });
  });

  it('grows a cantrip with the character, dice only', () => {
    expect([1, 5, 11, 17].map(cantripTier)).toEqual([1, 2, 3, 4]);
    expect(spellDamage('1d10 fire', 0, null, 11)).toEqual({ dice: { 10: 3 }, modifier: 0, mode: 'normal' });
    expect(spellDamage('1d8+2', 0, null, 5)).toEqual({ dice: { 8: 2 }, modifier: 2, mode: 'normal' });
  });
});
