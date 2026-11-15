import { describe, expect, it } from 'vitest';
import { peekCrop, peekPage } from '$lib/rules/peek';

describe('peek', () => {
  it('knows the page a link opens', () => {
    expect(peekPage('https://5e.tools/spells.html#fireball_xphb')).toBe('spells.html');
    expect(peekPage('https://5e.tools/search.html?q=Alert%20in:feat&lucky')).toBe('feats.html');
    expect(peekPage('https://5e.tools/search.html?q=Second%20Wind&lucky')).toBeNull();
    expect(peekPage('https://example.com/spells.html')).toBeNull();
  });
  it('cuts the hole over the entry panel', () => {
    expect(peekCrop('https://5e.tools/spells.html#fireball_xphb')).toEqual({ x: 800, y: 355, width: 463, foot: 190 });
    expect(peekCrop('https://5e.tools/races.html#tiefling_xphb')?.width).toBe(556);
    expect(peekCrop('https://5e.tools/classes.html#fighter_xphb')).toEqual({ x: 423, y: 330, width: 830, foot: 90 });
    // A search lands somewhere unknown: the widest panel, so nothing is cut off.
    expect(peekCrop('https://5e.tools/search.html?q=Second%20Wind&lucky')?.x).toBe(707);
    expect(peekCrop('https://www.dndbeyond.com/spells/fireball')).toBeNull();
  });
});
