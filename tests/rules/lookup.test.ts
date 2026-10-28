import { describe, expect, test } from 'vitest';
import { lookupUrl } from '$lib/rules/lookup';

const BASE = 'https://5e.tools';

describe('lookupUrl', () => {
  // Asserted against real URLs collected from 5e.tools during design.
  test('spell', () => {
    expect(lookupUrl('Command', 'xphb', 'spells')).toBe(`${BASE}/spells.html#command_xphb`);
  });

  test('item from a third-party source', () => {
    expect(lookupUrl('Revolver', 'valdagunslinger', 'items')).toBe(
      `${BASE}/items.html#revolver_valdagunslinger`
    );
  });

  test('a name with parentheses keeps them literal', () => {
    expect(lookupUrl('Tiefling (Glasya)', 'mtf', 'races')).toBe(
      `${BASE}/races.html#tiefling%20(glasya)_mtf`
    );
  });

  test('feat', () => {
    expect(lookupUrl('Archery', 'xphb', 'feats')).toBe(`${BASE}/feats.html#archery_xphb`);
  });

  test('background', () => {
    expect(lookupUrl('Artisan', 'xphb', 'backgrounds')).toBe(
      `${BASE}/backgrounds.html#artisan_xphb`
    );
  });

  test('an apostrophe survives unescaped', () => {
    expect(lookupUrl("Melf's Acid Arrow", 'xphb', 'spells')).toBe(
      `${BASE}/spells.html#melf's%20acid%20arrow_xphb`
    );
  });

  test('an override wins over name and source', () => {
    const override = `${BASE}/classes.html#gunslinger_valdagunslinger,state:feature=s2-0`;
    expect(lookupUrl('Gunslinger', 'xphb', 'classes', override)).toBe(override);
  });

  test('a homebrew source has no link', () => {
    expect(lookupUrl("Sheriff's Star", 'homebrew', 'items')).toBeNull();
  });

  test('a missing source has no link', () => {
    expect(lookupUrl('Mystery Item', undefined, 'items')).toBeNull();
  });

  test('an empty source has no link', () => {
    expect(lookupUrl('Mystery Item', '   ', 'items')).toBeNull();
  });

  test('an override still wins when the source is homebrew', () => {
    expect(lookupUrl("Sheriff's Star", 'homebrew', 'items', 'https://example.com/star')).toBe(
      'https://example.com/star'
    );
  });
});
