import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument, PDFTextField } from '@cantoo/pdf-lib';
import { sheetPdf } from '#lib/pdf/sheetPdf.ts';
import { plainText, sheetContent } from '#lib/pdf/content.ts';
import { emptyState, type Definition, type State } from '#lib/types.ts';
import { blankDefinition } from '#lib/sample.ts';

const loadFont = async (file: string) => new Uint8Array(readFileSync(`static/pdf/${file}`));

function hero(): { def: Definition; state: State } {
  const def = blankDefinition('Loka Sibbs');
  def.identity.classes = [{ name: 'Gunslinger', subclass: 'White Hat', level: 5 }];
  def.identity.ancestry = 'Tiefling';
  def.identity.background = 'Criminal';
  def.abilities = { str: 12, dex: 18, con: 16, int: 9, wis: 14, cha: 18 };
  def.saves = { dex: true, cha: true };
  def.skills = { acrobatics: { proficient: true }, stealth: { proficient: true, expertise: true } };
  def.combat.hpMax = 40;
  def.combat.hitDice = '5d8';
  def.attacks = [{ name: 'Blessed Revolver', bonus: '+10', damage: '2d6+1', damageType: 'piercing', notes: 'Slow: -10 ft.' }];
  def.features = Array.from({ length: 30 }, (_, i) => ({ title: `Feature ${i + 1}`, name: `Feature ${i + 1}`, body: 'You can do a thing. '.repeat(20), kind: i < 15 ? 'Class' : 'Feat' }));
  def.spells = [
    { name: 'Fire Bolt', level: 'Cantrip', damage: '2d10', save: '+7' },
    { name: 'Shield', level: '1', time: 'Rxn', range: 'Self', prepared: true },
    ...Array.from({ length: 60 }, (_, i) => ({ name: `Spell ${i}`, level: String((i % 3) + 1) }))
  ];
  def.equipment = Array.from({ length: 40 }, (_, i) => ({ name: `Item ${i}`, qty: 1, weight: 1, attuned: i === 3 }));
  const state = { ...emptyState(), hpCurrent: 33, hpTemp: 5, deathSaves: { successes: 1, failures: 2 } };
  return { def, state };
}

describe('sheet PDF', () => {
  it('works out what goes in the boxes', () => {
    const { def, state } = hero();
    const c = sheetContent(def, state);
    expect(c.classAndLevel).toBe('White Hat Gunslinger 5');
    expect(c.abilities.find((a) => a.key === 'dex')?.mod).toBe('+4');
    expect(c.saves.find((s) => s.key === 'dex')?.prof).toBe('●');
    expect(c.skills.find((s) => s.key === 'stealth')?.prof).toBe('◆');
    expect(c.attacks[0]).toMatchObject({ name: 'Blessed Revolver', damage: '2d6+1 piercing' });
    expect(c.attacks.some((a) => a.name === 'Fire Bolt')).toBe(true);
    expect(c.spellRows[0]).toEqual({ kind: 'head', cells: ['Cantrips'] });
  });

  it('turns notes into plain lines', () => {
    expect(plainText('## Day one\n**Bold** and [[c:red|red]] words\n- a point\n⁣ink:{"s":[]}')).toBe('DAY ONE\nBold and red words\n• a point');
  });

  it('makes a fillable PDF that keeps everything, however long', async () => {
    const { def, state } = hero();
    const bytes = await sheetPdf(def, state, { loadFont, notes: 'A note.\n'.repeat(400), picture: null });
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, bytes);
    const doc = await PDFDocument.load(bytes);
    // The paper sheet's four pages, however much is written: what does not
    // fit stays in the field it belongs to.
    expect(doc.getPageCount()).toBe(4);
    const form = doc.getForm();
    const value = (n: string) => (form.getField(n) as PDFTextField).getText();
    expect(value('CharacterName')).toBe('Loka Sibbs');
    expect(value('DEX')).toBe('18');
    expect(value('Wpn1Name')).toBe('Blessed Revolver');
    expect(value('CurrentHP')).toBe('33');
    expect(form.getCheckBox('DeathFailure2').isChecked()).toBe(true);
    // Nothing lost: every feature and item is somewhere in the form.
    const all = form.getFields().map((f) => (f instanceof PDFTextField ? f.getText() ?? '' : '')).join('\n');
    for (let i = 1; i <= 30; i++) expect(all).toContain(`Feature ${i}.`);
    for (let i = 0; i < 40; i++) expect(all).toContain(`Item ${i}`);
    for (let i = 0; i < 60; i++) expect(all).toContain(`Spell ${i}`);
  }, 120000);
});

describe('group titles', () => {
  it('names feature groups the way the sheet does', async () => {
    const { groupTitle } = await import('#lib/pdf/content.ts');
    expect(groupTitle('Class')).toBe('CLASS FEATURES');
    expect(groupTitle('Feat')).toBe('FEATS');
    expect(groupTitle('Weapon Mastery')).toBe('WEAPON MASTERIES');
    expect(groupTitle('Metamagic')).toBe('METAMAGIC');
    expect(groupTitle('Maneuver')).toBe('MANEUVERS');
  });
});

describe('page count', () => {
  it('has a spell page only for a caster', async () => {
    const plain = await PDFDocument.load(await sheetPdf(blankDefinition('Nobody'), emptyState(), { loadFont, picture: null }));
    expect(plain.getPageCount()).toBe(3);
    const caster = blankDefinition('Wiz');
    caster.spellcastingAbility = 'int';
    const doc = await PDFDocument.load(await sheetPdf(caster, emptyState(), { loadFont, picture: null }));
    expect(doc.getPageCount()).toBe(4);
    expect((doc.getForm().getField('SpellcastingAbility') as PDFTextField).getText()).toBe('INT');
  }, 60000);
});
