import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEMES,
  THEME_NAMES,
  isThemeName,
  swatchColor,
  themeOf,
  themeStyle
} from '$lib/theme';

describe('themes', () => {
  it('falls back to the default for anything unrecognised', () => {
    for (const bad of [undefined, null, '', 'chartreuse', 42, {}]) {
      expect(themeOf(bad)).toEqual(THEMES[DEFAULT_THEME]);
    }
  });

  it('keeps a stored theme', () => {
    expect(themeOf('verdigris')).toEqual(THEMES.verdigris);
  });

  it('emits both variables, since hue alone cannot make a neutral', () => {
    const style = themeStyle('ash');
    expect(style).toContain(`--h:${THEMES.ash.hue}`);
    expect(style).toContain(`--c:${THEMES.ash.chroma}`);
  });

  it('offers a theme that is genuinely neutral', () => {
    const muted = THEME_NAMES.filter((n) => THEMES[n].chroma < 0.2);
    expect(muted.length, 'at least one near-monochrome theme').toBeGreaterThan(0);
  });

  it('gives every theme a distinct hue and a label', () => {
    const hues = THEME_NAMES.map((n) => THEMES[n].hue);
    expect(new Set(hues).size).toBe(hues.length);
    for (const n of THEME_NAMES) expect(THEMES[n].label).toBeTruthy();
  });

  it('builds a swatch per theme', () => {
    for (const n of THEME_NAMES) expect(swatchColor(n)).toMatch(/^oklch\(/);
  });

  it('recognises only real theme names', () => {
    expect(isThemeName('copper')).toBe(true);
    expect(isThemeName('COPPER')).toBe(false);
    expect(isThemeName(undefined)).toBe(false);
  });
});
