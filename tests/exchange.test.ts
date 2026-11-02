/** Export and import: a character survives the trip, and a hostile file does no harm. */
import { describe, expect, it } from 'vitest';
import {
  FORMAT, TITLE, VERSION, exportFileName, exportSheet, importSheet, readDefinition, readState
} from '$lib/exchange';
import { blankDefinition } from '$lib/sample';
import { blankTexts, emptyState, type Definition, type State } from '$lib/types';

const character = (): Definition => ({
  ...blankDefinition('Loka Sibbs'),
  identity: {
    name: 'Loka Sibbs', level: 5, ancestry: 'Tiefling', class: 'Gunslinger', background: 'Outlaw',
    portraitUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQ/view', bannerUrl: 'https://i.imgur.com/abc12.jpg',
    theme: 'ember', classes: [{ name: 'Gunslinger', subclass: 'Deadeye', level: 5 }]
  },
  abilities: { str: 8, dex: 18, con: 14, int: 10, wis: 12, cha: 16 },
  proficiency: 3,
  combat: { ac: 17, speed: 30, hpMax: 44, hitDice: '5d10', initiative: 6 },
  saves: { dex: true, cha: true },
  saveBonuses: { dex: 1 },
  skills: { perception: { proficient: true }, stealth: { proficient: true, expertise: true } },
  attacks: [{ name: 'Revolver', bonus: '+7', damage: '2d6+4', damageType: 'piercing', source: 'valdagunslinger' }],
  features: [{ name: 'Second Wind', title: 'Second Wind', body: 'Regain 1d10 + level.', source: 'phb' }],
  spells: [{ name: 'Shield', level: '1', time: '1 reaction', components: 'V, S', prepared: true, source: 'xphb' }],
  equipment: [{ name: "Sheriff's Star", qty: 1, weight: 0.1, value: '50 gp', source: 'homebrew' }],
  trackers: [
    { id: 't1', label: 'Grit', max: 'cha', type: 'gauge', direction: 'spend', reset: { on: 'short', amount: 'full' }, die: 'd6' },
    { id: 't2', label: '1st', max: 4, type: 'pips', direction: 'spend', reset: { on: 'long', amount: 'full' }, group: 'Spell Slots' }
  ],
  currency: { gp: 11, sp: 6 },
  traits: { proficiencies: 'Light armour', languages: 'Common, Thieves’ cant', personality: 'Dry.' },
  senses: 'Darkvision 60 ft.',
  spellcastingAbility: 'cha', spellSaveDc: 14, spellAttackBonus: 6, abilitySaveDc: 14
});

const play = (): State => ({
  ...emptyState(), hpCurrent: 31, hpTemp: 5, hitDiceUsed: 2, trackers: { t1: 2, t2: 1 },
  deathSaves: { successes: 1, failures: 0 }, conditions: ['Prone', 'Bless'], inspiration: 1
});

const roundTrip = (def: Definition, state: State, texts = blankTexts()) => {
  const result = importSheet(exportSheet({ definition: def, state, texts }));
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe('export', () => {
  it('is plain text a person can read', () => {
    const text = exportSheet({ definition: character(), state: play(), texts: blankTexts() });
    expect(text.split('\n')[0]).toBe(TITLE);
    expect(text).toContain(`format: ${FORMAT}`);
    expect(text).toContain(`version: ${VERSION}`);
    expect(text).toContain('Loka Sibbs');
    expect(text).toContain('HP 31 / 44 · AC 17');
    expect(text.trimEnd().endsWith('===== END =====')).toBe(true);
  });

  it('keeps the long writing as itself, not as an escaped line', () => {
    const texts = blankTexts();
    texts.backstory.body = 'Born in a river town.\n\nLeft at sixteen.';
    const text = exportSheet({ definition: character(), state: play(), texts });
    expect(text).toContain('Born in a river town.\n\nLeft at sixteen.');
    expect(text).not.toContain('\\n');
  });

  it('says on the section whether a writing is private', () => {
    const texts = blankTexts();
    texts.notes.isPublic = false;
    const text = exportSheet({ definition: character(), state: play(), texts });
    expect(text).toContain('===== NOTES [private] =====');
    expect(text).toContain('===== BACKSTORY [shared] =====');
  });

  it('names the file after the character, safely', () => {
    expect(exportFileName(character())).toBe('loka-sibbs.dndsheet.txt');
    expect(exportFileName({ ...character(), identity: { name: '  Zoë / O’Neil: "the Bold"  ', level: 1 } })).toBe('zoe-o-neil-the-bold.dndsheet.txt');
    expect(exportFileName({ ...character(), identity: { name: '', level: 1 } })).toBe('character.dndsheet.txt');
    expect(exportFileName({ ...character(), identity: { name: '../../etc/passwd', level: 1 } })).not.toMatch(/[./\\]{2}|\//);
  });

  it('reads from the definition when the database keeps the writing there', () => {
    const def = { ...character(), notes: 'Old notes', backstory: 'Old story' };
    const r = importSheet(exportSheet({ definition: def, state: play(), texts: null }));
    expect(r.ok && r.value.texts.notes.body).toBe('Old notes');
    expect(r.ok && r.value.texts.backstory.body).toBe('Old story');
  });
});

describe('round trip', () => {
  it('brings the whole character back exactly', () => {
    const def = character();
    const { value } = roundTrip(def, play());
    // The writing travels separately; everything else is identical.
    expect(value.definition).toEqual({ ...def, notes: '' });
  });

  it('brings the play state back', () => {
    expect(roundTrip(character(), play()).value.state).toEqual(play());
  });

  it('brings the writing back exactly, private or not', () => {
    const texts = blankTexts();
    texts.notes = { body: 'Line one\n  indented\n\nlast', isPublic: false, updatedAt: 'T1' };
    texts.backstory = { body: 'A story.\n', isPublic: true, updatedAt: null };
    const { value } = roundTrip(character(), play(), texts);
    expect(value.texts.notes).toEqual({ body: 'Line one\n  indented\n\nlast', isPublic: false });
    expect(value.texts.backstory).toEqual({ body: 'A story.\n', isPublic: true });
  });

  it('cannot be fooled by writing that looks like the format itself', () => {
    const nasty = 'before\n===== END =====\n===== STATE =====\n{"hpCurrent": 99999}\n\\===== backslash\n\\\nafter';
    const texts = blankTexts();
    texts.notes.body = nasty;
    const { value } = roundTrip(character(), play(), texts);
    expect(value.texts.notes.body).toBe(nasty);
    expect(value.state.hpCurrent).toBe(31);
  });

  it('keeps pages as pages, written as marker lines a person can read', () => {
    const texts = blankTexts();
    texts.backstory.body = 'Chapter one.\n\fChapter two.\fChapter three.\n';
    const file = exportSheet({ definition: character(), state: play(), texts });
    expect(file).not.toContain('\f');
    expect(file.match(/^===== PAGE =====$/gm)).toHaveLength(2);
    const { value } = importSheet(file) as { value: { texts: { backstory: { body: string } } } };
    expect(value.texts.backstory.body).toBe(texts.backstory.body);
  });

  it('does not take writing that looks like a page marker for one', () => {
    const texts = blankTexts();
    texts.notes.body = '===== PAGE =====';
    expect(roundTrip(character(), play(), texts).value.texts.notes.body).toBe('===== PAGE =====');
  });

  it('keeps empty pages too', () => {
    const texts = blankTexts();
    texts.notes.body = '\f\fend';
    expect(roundTrip(character(), play(), texts).value.texts.notes.body).toBe('\f\fend');
  });

  it('keeps empty and whitespace-only writing as it was', () => {
    for (const body of ['', '\n', '   ', '\n\n']) {
      const texts = blankTexts();
      texts.notes.body = body;
      expect(roundTrip(character(), play(), texts).value.texts.notes.body).toBe(body);
    }
  });

  it('survives a file saved with Windows line endings and a byte order mark', () => {
    const texts = blankTexts();
    texts.backstory.body = 'one\ntwo';
    const file = '﻿' + exportSheet({ definition: character(), state: play(), texts }).replace(/\n/g, '\r\n');
    const r = importSheet(file);
    expect(r.ok && r.value.texts.backstory.body).toBe('one\ntwo');
    expect(r.ok && r.value.definition.identity.name).toBe('Loka Sibbs');
  });

  it('keeps unicode and long text intact', () => {
    const texts = blankTexts();
    texts.backstory.body = 'Ünï©ödé — 日本語 🎲\n' + 'word '.repeat(5000);
    expect(roundTrip(character(), play(), texts).value.texts.backstory.body).toBe(texts.backstory.body);
  });

  it('works for a sheet that is nearly empty', () => {
    const { value, warnings } = roundTrip(blankDefinition('New character'), emptyState());
    expect(value.definition).toEqual(blankDefinition('New character'));
    expect(warnings).toEqual([]);
  });
});

describe('refusing what is not a sheet', () => {
  const good = () => exportSheet({ definition: character(), state: play(), texts: blankTexts() });

  it.each([
    ['an empty file', ''],
    ['some other text', 'Hello, this is a shopping list.'],
    ['JSON', '{"identity": {"name": "x"}}'],
    ['the right title but the wrong format', `${TITLE}\nformat: something-else\nversion: 1\n\n===== END =====`]
  ])('says so for %s', (_n, text) => {
    const r = importSheet(text);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not a DND Companion sheet/i);
  });

  it('says when it was made by a newer version', () => {
    const r = importSheet(good().replace(`version: ${VERSION}`, `version: ${VERSION + 1}`));
    expect(!r.ok && r.error).toMatch(/newer version/i);
  });

  it('says when the version is missing or nonsense', () => {
    for (const v of ['version: x', 'version: 0', 'version: 1.5']) {
      const r = importSheet(good().replace(`version: ${VERSION}`, v));
      expect(r.ok, v).toBe(false);
    }
  });

  it('says when it was cut short', () => {
    const r = importSheet(good().replace('===== END =====', ''));
    expect(!r.ok && r.error).toMatch(/cut short/i);
  });

  it('says when the character is missing or unreadable', () => {
    expect(!importSheet(good().replace(/===== DEFINITION =====[\s\S]*?(?====== STATE)/, '')).ok).toBe(true);
    const broken = good().replace('"name": "Loka Sibbs"', '"name": ');
    const r = importSheet(broken);
    expect(!r.ok && r.error).toMatch(/character part/i);
  });

  it('says when the state is unreadable rather than quietly using a blank one', () => {
    const r = importSheet(good().replace('"hpCurrent": 31', '"hpCurrent": '));
    expect(!r.ok && r.error).toMatch(/state part/i);
  });

  it('does not take a second section of the same name over the first', () => {
    const file = good().replace('===== END =====', '===== STATE =====\n{"hpCurrent": 1}\n\n===== END =====');
    const r = importSheet(file);
    expect(r.ok && r.value.state.hpCurrent).toBe(31);
  });
});

describe('a hostile or damaged file', () => {
  const wrap = (definition: unknown, state: unknown = {}) =>
    `${TITLE}\nformat: ${FORMAT}\nversion: 1\n\n===== DEFINITION =====\n${JSON.stringify(definition)}\n\n===== STATE =====\n${JSON.stringify(state)}\n\n===== END =====\n`;

  it('gives a character whose name is not text a placeholder rather than refusing it', () => {
    const r = importSheet(wrap({ identity: { name: 42, level: 3 } }));
    expect(r.ok && r.value.name).toBe('Imported character');
    expect(r.ok && r.value.definition.identity.level).toBe(3);
  });

  it('fills a damaged sheet from a blank one', () => {
    const r = importSheet(wrap({
      identity: { name: 'Damaged', level: 'five' }, abilities: { str: 'strong', dex: null },
      proficiency: 'lots', combat: { ac: 'x', hpMax: 'many', hitDice: 6 }, attacks: 'none', currency: { gp: 'rich' }
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const d = r.value.definition;
    expect(d.identity.level).toBe(1);
    expect(d.abilities.str).toBe(10);
    expect(d.abilities.dex).toBe(10);
    expect(d.proficiency).toBe(2);
    expect(d.combat).toMatchObject({ ac: 10, hpMax: 1, hitDice: '1d8' });
    expect(d.attacks).toEqual([]);
    expect(d.currency).toEqual({});
    expect(r.warnings.join(' ')).toMatch(/left behind/);
  });

  it('keeps numbers inside sane limits', () => {
    const r = importSheet(wrap({
      identity: { name: 'Big', level: 9999 }, abilities: { str: 1e12, dex: -50 },
      combat: { ac: 1e9, hpMax: 1e12, speed: -5, hitDice: '1d8' }
    }, { hpCurrent: 1e15, hpTemp: -9, deathSaves: { successes: 99, failures: -1 } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.definition.identity.level).toBe(30);
    expect(r.value.definition.abilities).toMatchObject({ str: 40, dex: 0 });
    expect(r.value.definition.combat).toMatchObject({ ac: 99, hpMax: 99999, speed: 0 });
    expect(r.value.state).toMatchObject({ hpCurrent: 99999, hpTemp: 0, deathSaves: { successes: 3, failures: 0 } });
  });

  it('does not let a __proto__ key reach the object chain', () => {
    const file = wrap({ identity: { name: 'P', level: 1 } }).replace(
      '"identity"', '"__proto__": {"polluted": true}, "constructor": {"prototype": {"polluted": true}}, "identity"'
    );
    const r = importSheet(file);
    expect(r.ok).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    if (r.ok) expect((r.value.definition as unknown as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('copies plain values only: no nested objects hide inside an entry', () => {
    const r = importSheet(wrap({
      identity: { name: 'N', level: 1 },
      equipment: [{ name: 'Rope', qty: 1, trap: { deep: { deeper: true } }, list: [1, 2], fn: null }, 'not an entry', 7, null]
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.definition.equipment).toEqual([{ name: 'Rope', qty: 1 }]);
    expect(r.warnings.join(' ')).toMatch(/3 entries were/);
  });

  it('repairs a tracker rather than letting a malformed one reach the page', () => {
    const r = importSheet(wrap({
      identity: { name: 'T', level: 1 },
      trackers: [{ label: 'No id', max: { x: 1 }, type: 'weird', direction: 'sideways', reset: 'never' }, { id: 'k', label: 'Fine', max: 3, type: 'pips', direction: 'spend', reset: { on: 'long', amount: 'full' } }]
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [bad, fine] = r.value.definition.trackers;
    expect(bad).toMatchObject({ id: 'imported-0', max: 1, type: 'pips', direction: 'spend', reset: { on: 'manual', amount: 'full' } });
    expect(fine).toMatchObject({ id: 'k', max: 3 });
  });

  it('ignores unknown skills, saves and classes of ability', () => {
    const d = readDefinition({
      identity: { name: 'S', level: 1 },
      skills: { perception: { proficient: true }, basketWeaving: { proficient: true }, stealth: 'yes' },
      saves: { dex: true, luck: true, str: 'yes' }, spellcastingAbility: 'luck'
    });
    expect(d.skills).toEqual({ perception: { proficient: true } });
    expect(d.saves).toEqual({ dex: true });
    expect(d.spellcastingAbility).toBeUndefined();
  });

  it('keeps conditions as short text, and tracker counts as whole numbers', () => {
    const s = readState({ conditions: ['Prone', 7, '', '  Bless  ', 'x'.repeat(100)], trackers: { a: 2.6, b: -1, c: 'x' } });
    expect(s.conditions).toEqual(['Prone', 'Bless', 'x'.repeat(40)]);
    expect(s.trackers).toEqual({ a: 3 });
  });

  it('never carries the writing in through the definition', () => {
    const r = importSheet(wrap({ identity: { name: 'N', level: 1 }, notes: 'sneaky', backstory: 'sneakier' }));
    expect(r.ok && r.value.definition.notes).toBe('');
    expect(r.ok && r.value.definition.backstory).toBe('');
    expect(r.ok && r.value.texts.notes.body).toBe('');
  });

  it('is shared unless the file says private, so a damaged marker cannot hide text from its owner', () => {
    const file = wrap({ identity: { name: 'N', level: 1 } }).replace('===== END =====', '===== NOTES =====\nhi\n\n===== END =====');
    const r = importSheet(file);
    expect(r.ok && r.value.texts.notes).toEqual({ body: 'hi', isPublic: true });
  });
});

describe('private marker', () => {
  it('notes on the definition which writings are private, from the writing itself', () => {
    const texts = blankTexts();
    texts.backstory = { body: 'Secret.', isPublic: false, updatedAt: null };
    const def = { ...character(), privateText: { notes: true } };
    const { value } = roundTrip(def, play(), texts);
    expect(value.definition.privateText).toEqual({ backstory: true });
  });

  it('leaves no marker when nothing is private', () => {
    const { value } = roundTrip({ ...character(), privateText: { notes: true } }, play());
    expect(value.definition.privateText).toBeUndefined();
  });
});

describe('fields added since the format was written', () => {
  it('carries class sources, item value and source, spell source, pictures and pages', () => {
    const def = character();
    def.identity = {
      ...def.identity,
      classes: [{ name: 'Fighter', level: 2, source: 'xphb' }],
      portraitUrl: 'https://drive.google.com/file/d/abcdefghijklmnop/view',
      bannerUrl: 'https://i.imgur.com/abcdefg.png'
    };
    def.equipment = [{ name: 'Rope', qty: 1, value: '1 gp', source: 'xphb' }];
    def.spells = [{ name: 'Shield', level: '1', source: 'xphb', prepared: true }];
    const texts = blankTexts();
    texts.notes = { body: 'One\fTwo', isPublic: false, updatedAt: null };
    const { value } = roundTrip(def, play(), texts);
    expect(value.definition.identity.classes).toEqual([{ name: 'Fighter', level: 2, source: 'xphb' }]);
    expect(value.definition.identity.portraitUrl).toBe(def.identity.portraitUrl);
    expect(value.definition.identity.bannerUrl).toBe(def.identity.bannerUrl);
    expect(value.definition.equipment).toEqual(def.equipment);
    expect(value.definition.spells).toEqual(def.spells);
    expect(value.texts.notes).toEqual({ body: 'One\fTwo', isPublic: false });
    expect(value.definition.privateText).toEqual({ notes: true });
    expect(value.state.conditions).toEqual(['Prone', 'Bless']);
  });
});
