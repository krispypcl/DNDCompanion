import { describe, expect, it } from 'vitest';
import { nameFont } from '$lib/rules/fonts';

describe('the name font', () => {
  it('takes the font page, the stylesheet link, the embed code or the name', () => {
    expect(nameFont('https://fonts.google.com/specimen/Cinzel+Decorative')).toEqual({
      family: 'Cinzel Decorative', href: 'https://fonts.googleapis.com/css2?family=Cinzel+Decorative&display=swap'
    });
    expect(nameFont('https://fonts.googleapis.com/css2?family=Pirata+One&display=swap')).toEqual({
      family: 'Pirata One', href: 'https://fonts.googleapis.com/css2?family=Pirata+One&display=swap'
    });
    expect(nameFont('<link href="https://fonts.googleapis.com/css2?family=Uncial+Antiqua:wght@400&amp;display=swap" rel="stylesheet">'))
      .toEqual({ family: 'Uncial Antiqua', href: 'https://fonts.googleapis.com/css2?family=Uncial+Antiqua:wght@400&display=swap' });
    expect(nameFont("@import url('https://fonts.googleapis.com/css2?family=Almendra&display=swap');")?.toString()).toBeTruthy();
    expect(nameFont('MedievalSharp')).toEqual({ family: 'MedievalSharp', href: 'https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap' });
  });
  it('says so when it is not a font', () => {
    expect(nameFont('')).toBeNull();
    expect(nameFont('https://example.com/font.woff')).toBe('bad');
    expect(nameFont('<script>')).toBe('bad');
  });
});
