import { describe, expect, it } from 'vitest';
import { trackerUrl } from '$lib/rules/lookup';
import { trackerMax } from '$lib/rules/tracker';

describe('trackerUrl', () => {
  it('links a class feature straight to its place on the class page', () => {
    expect(trackerUrl({ label: 'Second Wind', class: 'Fighter' })).toBe('https://5e.tools/classes.html#fighter_xphb,state:feature=s0-1');
    expect(trackerUrl({ label: 'Sorcery Points', class: 'Sorcerer' })).toBe('https://5e.tools/classes.html#sorcerer_xphb,state:feature=s1-0');
    expect(trackerUrl({ label: '3rd-level slots', class: 'Wizard' })).toMatch(/wizard_xphb,state:feature=s0-0$/);
  });
  it('uses the 2014 book when the class says so', () => {
    expect(trackerUrl({ label: 'Second Wind', class: 'Fighter' }, [{ name: 'Fighter', source: 'phb' }])).toMatch(/#fighter_phb,state:feature=s0-1$/);
  });
  it('opens the subclass for a subclass feature', () => {
    expect(trackerUrl({ label: 'Superiority Dice', class: 'Fighter' })).toBe('https://5e.tools/classes.html#fighter_xphb,state:sub_battle%20master_xphb=b1');
  });
  it('links what a feat or species tracker comes from', () => {
    expect(trackerUrl({ label: 'Luck Points', class: 'Lucky' })).toBe('https://5e.tools/search.html?q=Lucky&lucky');
  });
  it('keeps the old search without a From, and no link for homebrew', () => {
    expect(trackerUrl({ label: 'Risk Dice' })).toMatch(/search\.html\?q=Risk%20Dice/);
    expect(trackerUrl({ label: 'Risk Dice', class: 'Gunslinger', source: 'homebrew' })).toBeNull();
  });
});

describe('classlevel for a tracker from a feat', () => {
  const ctx = { level: 7, classlevel: 7, prof: 3, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, classLevels: { fighter: 5, wizard: 2 } };
  it('is the total level, not 0', () => {
    expect(trackerMax({ id: 'a', label: 'Luck', max: 'classlevel', class: 'Lucky', type: 'pips', direction: 'spend', reset: { on: 'long', amount: 'full' } }, ctx as never)).toBe(7);
    expect(trackerMax({ id: 'b', label: 'X', max: 'classlevel', class: 'Fighter', type: 'pips', direction: 'spend', reset: { on: 'long', amount: 'full' } }, ctx as never)).toBe(5);
    expect(trackerMax({ id: 'c', label: 'X', max: 'classlevel', class: 'Paladin', type: 'pips', direction: 'spend', reset: { on: 'long', amount: 'full' } }, ctx as never)).toBe(0);
  });
});
