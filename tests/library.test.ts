import { describe, expect, it } from 'vitest';
import { differences, fillRow, libraryRow, sheetLibraryRows, summary } from '$lib/library';
import { blankDefinition } from '$lib/sample';

describe('shared library rows', () => {
  it('keeps the entry and leaves out what is the character’s own', () => {
    const row = libraryRow('items', { name: '  Bag of   Holding ', qty: 2, equipped: true, attuned: false, weight: 15, value: '', source: 'XDMG' });
    expect(row).toEqual({ kind: 'items', name: 'Bag of Holding', data: { name: 'Bag of Holding', source: 'XDMG', weight: 15 } });
  });

  it('skips a row with nothing but its name', () => {
    expect(libraryRow('spells', { name: 'Shield', prepared: true })).toBeNull();
    expect(libraryRow('spells', { name: '   ', level: '1' })).toBeNull();
  });

  it('uses each table’s own name field', () => {
    expect(libraryRow('features', { title: 'Second Wind', body: 'Regain 1d10 + level hit points' })?.name).toBe('Second Wind');
    expect(libraryRow('trackers', { id: 'x', label: 'Ki', max: 'classlevel', group: 'Monk' })?.data).toEqual({ label: 'Ki', max: 'classlevel' });
  });

  it('fills a row from an entry but keeps its own amount and flags', () => {
    const filled = fillRow('items', { name: 'rope', qty: 3, equipped: true, notes: 'frayed' }, { name: 'Rope, Hempen', weight: 10 });
    expect(filled).toEqual({ qty: 3, equipped: true, name: 'Rope, Hempen', weight: 10 });
  });

  it('says how two versions differ', () => {
    const a = { name: 'Fireball', level: '3', damage: '8d6' };
    const b = { name: 'Fireball', level: '3', damage: '8d6 +1d6/level', notes: 'Upcast' };
    expect(differences('spells', b, a)).toEqual(['damage', 'notes']);
    expect(summary('spells', b, ['damage'])).toBe('8d6 +1d6/level');
    expect(summary('spells', { ...a, source: 'xphb' })).toBe('Level 3 · 8d6 · XPHB');
  });

  it('gathers a whole sheet', () => {
    const def = blankDefinition();
    def.spells = [{ name: 'Fireball', level: '3' }];
    def.equipment = [{ name: 'Torch', qty: 5 }];
    def.features = [{ name: '', title: 'Darkvision', body: '60 feet', kind: 'Species' }];
    const kinds = sheetLibraryRows(def).map((r) => `${r.kind}:${r.name}`);
    expect(kinds).toEqual(['spells:Fireball', 'features:Darkvision']);
  });
});
