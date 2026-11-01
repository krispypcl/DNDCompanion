import { describe, expect, test } from 'vitest';
import { lookupName, lookupUrl } from '$lib/rules/lookup';

const query = (url: string | null) => {
  const u = new URL(url!);
  expect(u.origin + u.pathname).toBe('https://5e.tools/search.html');
  expect(u.searchParams.has('lucky')).toBe(true);
  return u.searchParams.get('q');
};

describe('lookupUrl', () => {
  test('goes through 5e.tools search, which opens the best match', () => {
    expect(query(lookupUrl('Fireball', 'xphb', 'spells'))).toBe('Fireball in:sp source:xphb');
  });

  test('narrows by category for items, classes, backgrounds, species and conditions', () => {
    expect(query(lookupUrl('Longsword', 'xphb', 'items'))).toBe('Longsword in:itm source:xphb');
    expect(query(lookupUrl('Fighter', 'xphb', 'classes'))).toBe('Fighter in:class source:xphb');
    expect(query(lookupUrl('Artisan', 'xphb', 'backgrounds'))).toBe('Artisan in:bg source:xphb');
    expect(query(lookupUrl('Tiefling', 'xphb', 'races'))).toBe('Tiefling in:species source:xphb');
    expect(query(lookupUrl('Champion', undefined, 'subclasses'))).toBe('Champion in:subclass');
  });

  test('does not narrow a feature, which may be a feat or a class feature', () => {
    expect(query(lookupUrl('Second Wind', 'xphb', 'feats'))).toBe('Second Wind source:xphb');
  });

  test('puts the source last, since 5e.tools reads the rest of the query as the source', () => {
    expect(query(lookupUrl('Shield', 'phb', 'spells'))!.endsWith('source:phb')).toBe(true);
  });

  test('still links with no source, by name alone', () => {
    expect(query(lookupUrl('Rope', undefined, 'items'))).toBe('Rope in:itm');
    expect(query(lookupUrl('Rope', '  ', 'items'))).toBe('Rope in:itm');
  });

  test('leaves out what is the player’s, not the book’s', () => {
    expect(query(lookupUrl('Revolver (+1)', 'xphb', 'items'))).toBe('Revolver in:itm source:xphb');
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

  test('a species link searches for the variant itself', () => {
    expect(query(lookupUrl('Tiefling (Glasya)', undefined, 'races'))).toBe('Tiefling (Glasya) in:species');
  });

  test('keeps names that are the book’s own', () => {
    expect(lookupName("Melf's Acid Arrow")).toBe("Melf's Acid Arrow");
    expect(lookupName('Bigby’s Hand')).toBe('Bigby’s Hand');
    expect(lookupName('Half-Elf')).toBe('Half-Elf');
  });
});
