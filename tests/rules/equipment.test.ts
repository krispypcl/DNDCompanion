import { describe, expect, it } from 'vitest';
import { armorClass, initiativeParts, modifierOf, saveBonus, speedParts } from '$lib/rules/derived';
import { guessEffects } from '$lib/rules/equipment';

const def = (equipment: unknown[] = [], over: Record<string, unknown> = {}) => ({
  identity: { name: 'X', level: 5 }, abilities: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 },
  proficiency: 3, combat: { ac: 14, speed: 30, hpMax: 10, hitDice: '5d8' }, saves: { dex: true }, skills: {},
  attacks: [], features: [], spells: [], trackers: [], equipment, currency: {}, notes: '', ...over
}) as never;

describe('equipment effects', () => {
  it('keeps the written AC until something that touches it is equipped', () => {
    expect(armorClass(def()).total).toBe(14);
    expect(armorClass(def([{ name: 'Leather armor', equipped: false, effects: [{ kind: 'armor', base: 11, dex: 'full' }] }])).computed).toBe(false);
  });
  it('works out armour, Dexterity as allowed, shields and bonuses', () => {
    const leather = { name: 'Leather armor', equipped: true, effects: [{ kind: 'armor', base: 11, dex: 'full' }] };
    const shield = { name: 'Shield', equipped: true, effects: [{ kind: 'shield', bonus: 2 }] };
    expect(armorClass(def([leather, shield])).total).toBe(16);
    const breastplate = { name: 'Breastplate', equipped: true, effects: [{ kind: 'armor', base: 14, dex: 'max2' }] };
    expect(armorClass(def([breastplate])).total).toBe(16);
    const plate = { name: 'Plate', equipped: true, effects: [{ kind: 'armor', base: 18, dex: 'none' }] };
    expect(armorClass(def([plate])).total).toBe(18);
    expect(armorClass(def([shield])).total).toBe(15); // unarmoured 10 + 3 + 2
  });
  it('sets or raises ability scores, and everything follows', () => {
    const gauntlets = { name: 'Gauntlets', equipped: true, effects: [{ kind: 'ability', ability: 'str', mode: 'set', value: 19 }] };
    expect(modifierOf(def([gauntlets]), 'str')).toBe(4);
    const belt = { name: 'Belt', equipped: true, effects: [{ kind: 'ability', ability: 'dex', mode: 'bonus', value: 2 }] };
    expect(modifierOf(def([belt]), 'dex')).toBe(4);
    expect(initiativeParts(def([belt])).total).toBe(4);
  });
  it('adds to saves, speed and initiative', () => {
    const ring = { name: 'Ring of Protection', equipped: true, effects: [{ kind: 'ac', bonus: 1 }, { kind: 'save', ability: 'all', bonus: 1 }] };
    expect(saveBonus(def([ring]), 'dex')).toBe(3 + 3 + 1);
    const boots = { name: 'Boots', equipped: true, effects: [{ kind: 'speed', bonus: 10 }] };
    expect(speedParts(def([boots])).total).toBe(40);
  });
  it('guesses armour and shields from their names', () => {
    expect(guessEffects('Studded leather armor +1')).toEqual([{ kind: 'armor', base: 13, dex: 'full' }]);
    expect(guessEffects('Half plate')).toEqual([{ kind: 'armor', base: 15, dex: 'max2' }]);
    expect(guessEffects('Shield')).toEqual([{ kind: 'shield', bonus: 2 }]);
    expect(guessEffects('Rope')).toEqual([]);
  });
});
