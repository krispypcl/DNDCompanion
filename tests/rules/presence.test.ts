import { describe, expect, it } from 'vitest';
import { hereText, webLink } from '#lib/rules/presence.ts';

describe('hereText', () => {
  it('names the DM and counts the players, in one line', () => {
    expect(hereText(true, 3)).toBe('DM and 3 players here');
    expect(hereText(true, 1)).toBe('DM and 1 player here');
    expect(hereText(true, 0)).toBe('DM here');
    expect(hereText(false, 2)).toBe('2 players here');
    expect(hereText(false, 0)).toBe('');
  });
});

describe('webLink', () => {
  it('keeps web addresses, adding https when it was left off', () => {
    expect(webLink('https://www.owlbear.rodeo/room/abc/Shadowfell')).toBe('https://www.owlbear.rodeo/room/abc/Shadowfell');
    expect(webLink('owlbear.rodeo/room/abc')).toBe('https://owlbear.rodeo/room/abc');
  });
  it('turns away anything else', () => {
    expect(webLink('')).toBeNull();
    expect(webLink('javascript:alert(1)')).toBeNull();
    expect(webLink('not a link at all')).toBeNull();
  });
});
