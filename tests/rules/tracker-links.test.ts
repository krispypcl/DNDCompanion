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
    expect(trackerUrl({ label: 'Superiority Dice', class: 'Fighter' })).toBe('https://5e.tools/classes.html#fighter_xphb,state:feature=s2-0~sub_battle%20master_xphb=b1');
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

import { featureUrl } from '$lib/rules/lookup';

describe('featureUrl', () => {
  const identity = { ancestry: 'Tiefling (Asmodeus)', ancestrySource: 'xphb', background: 'Criminal', backgroundSource: 'xphb' };
  const classes = [{ name: 'Fighter', subclass: 'Battle Master', level: 3, source: 'xphb' }];
  it('sends every species feature to the species on the Character tab', () => {
    const a = featureUrl({ title: 'Hellish Resistance', kind: 'Species' }, identity, classes);
    const b = featureUrl({ title: 'Legacy of Malbolge', kind: 'Species' }, identity, classes);
    expect(a).toBe('https://5e.tools/races.html#tiefling%20(asmodeus)_xphb');
    expect(b).toBe(a);
  });
  it('sends a background feature to the background', () => {
    expect(featureUrl({ title: 'Criminal Contact', kind: 'Background' }, identity, classes)).toBe('https://5e.tools/backgrounds.html#criminal_xphb');
  });
  it('finds a class feature on its class page, and a subclass feature on its subclass', () => {
    expect(featureUrl({ title: 'Second Wind', kind: 'Class' }, identity, classes)).toBe('https://5e.tools/classes.html#fighter_xphb,state:feature=s0-1');
    expect(featureUrl({ title: 'Combat Superiority', kind: 'Subclass' }, identity, classes)).toMatch(/fighter_xphb,state:feature=s2-0~sub_battle%20master_xphb=b1$/);
    expect(featureUrl({ title: 'Something homemade', kind: 'Subclass' }, identity, classes)).toMatch(/classes\.html#fighter_xphb,state:feature=s2-0~sub_battle%20master_xphb=b1$/);
  });
  it('keeps a feat, or anything else, to its own name', () => {
    expect(featureUrl({ title: 'Lucky', kind: 'Feat' }, identity, classes)).toMatch(/search\.html\?q=Lucky/);
  });
});
