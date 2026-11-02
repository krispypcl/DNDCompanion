import { describe, expect, test } from 'vitest';
import { lookupName, lookupUrl, sourceId } from '$lib/rules/lookup';

const query = (url: string | null) => {
  const u = new URL(url!);
  expect(u.origin + u.pathname).toBe('https://5e.tools/search.html');
  expect(u.searchParams.has('lucky')).toBe(true);
  return u.searchParams.get('q');
};

describe('lookupUrl', () => {
  test('with a book, goes straight to the entry, as 5e.tools builds its own links', () => {
    expect(lookupUrl('Tiefling (Glasya)', 'mtf', 'races')).toBe('https://5e.tools/races.html#tiefling%20(glasya)_mtf');
    expect(lookupUrl('Fireball', 'xphb', 'spells')).toBe('https://5e.tools/spells.html#fireball_xphb');
    expect(lookupUrl('Longsword', 'XPHB', 'items')).toBe('https://5e.tools/items.html#longsword_xphb');
    expect(lookupUrl('Fighter', 'xphb', 'classes')).toBe('https://5e.tools/classes.html#fighter_xphb');
    expect(lookupUrl('Artisan', 'xphb', 'backgrounds')).toBe('https://5e.tools/backgrounds.html#artisan_xphb');
    expect(lookupUrl("Melf's Acid Arrow", 'phb', 'spells')).toBe("https://5e.tools/spells.html#melf's%20acid%20arrow_phb");
  });

  test('opens a subclass on its class page with the subclass chosen', () => {
    expect(lookupUrl('White Hat', 'valdagunslinger', 'subclasses', undefined, { name: 'Gunslinger', source: 'valdagunslinger' })).toBe(
      'https://5e.tools/classes.html#gunslinger_valdagunslinger,state:sub_white%20hat_valdagunslinger=b1'
    );
  });

  test('without a book, searches by name and opens the best match', () => {
    expect(query(lookupUrl('Rope', undefined, 'items'))).toBe('Rope in:itm');
    expect(query(lookupUrl('Tiefling (Glasya)', '  ', 'races'))).toBe('Tiefling (Glasya) in:species');
    expect(query(lookupUrl('Champion', undefined, 'subclasses'))).toBe('Champion in:subclass');
  });

  test('searches for a feature even with a book, since it may be a feat or a class feature', () => {
    expect(query(lookupUrl('Second Wind', 'xphb', 'feats'))).toBe('Second Wind source:xphb');
  });

  test('leaves out what is the player’s, not the book’s', () => {
    expect(lookupUrl('Revolver (+1)', 'xphb', 'items')).toBe('https://5e.tools/items.html#revolver_xphb');
  });

  test('an override wins over name and source', () => {
    const override = 'https://5e.tools/classes.html#gunslinger_valdagunslinger,state:feature=s2-0';
    expect(lookupUrl('Gunslinger', 'xphb', 'classes', override)).toBe(override);
  });

  test('a homebrew source has no link, unless overridden', () => {
    expect(lookupUrl("Sheriff's Star", 'homebrew', 'items')).toBeNull();
    expect(lookupUrl("Sheriff's Star", 'homebrew', 'items', 'https://example.com/star')).toBe('https://example.com/star');
  });

  test('no name, no link', () => {
    expect(lookupUrl('(+1)', 'xphb', 'items')).toBeNull();
  });
});

describe('lookupName', () => {
  test('strips bonuses, counts and bracketed notes', () => {
    expect(lookupName('Revolver (+1)')).toBe('Revolver');
    expect(lookupName('Longsword +1')).toBe('Longsword');
    expect(lookupName('+2 Shield')).toBe('Shield');
    expect(lookupName('Arrows x20')).toBe('Arrows');
    expect(lookupName('20x Arrows')).toBe('Arrows');
    expect(lookupName('Potion of Healing ×3')).toBe('Potion of Healing');
    expect(lookupName('Cloak of Elvenkind [attuned]')).toBe('Cloak of Elvenkind');
  });

  test('keeps a variant the book names in brackets, for species and the like', () => {
    expect(lookupName('Tiefling (Glasya)', 'races')).toBe('Tiefling (Glasya)');
    expect(lookupName('Elf (High)', 'races')).toBe('Elf (High)');
    expect(lookupName('Tiefling (Glasya) (+1 CHA)', 'races')).toBe('Tiefling (Glasya)');
    expect(lookupName('Revolver (silvered)', 'items')).toBe('Revolver');
  });

  test('keeps names that are the book’s own', () => {
    expect(lookupName("Melf's Acid Arrow")).toBe("Melf's Acid Arrow");
    expect(lookupName('Bigby’s Hand')).toBe('Bigby’s Hand');
    expect(lookupName('Half-Elf')).toBe('Half-Elf');
  });
});

describe('homebrew sources', () => {
  test('a book written as 5e.tools shows it links by its id', () => {
    expect(lookupUrl('Revolver (+1)', "GC:VSS'24", 'items')).toBe('https://5e.tools/items.html#revolver_valdagunslinger');
    expect(sourceId("gc:vss'24")).toBe('valdagunslinger');
  });
  test('an official book is left as written', () => {
    expect(sourceId('XPHB')).toBe('xphb');
  });
});
