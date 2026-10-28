import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEMES,
  THEME_NAMES,
  customTheme,
  isThemeName,
  seedHex,
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

describe('a colour the player picked', () => {
  it('reads hue and chroma out of a hex', () => {
    const t = customTheme('#d2783b')!; // the copper preset's own hex
    expect(t.hue).toBeGreaterThan(40);
    expect(t.hue).toBeLessThan(65);
    expect(t.chroma).toBeGreaterThan(0.8);
  });

  it('themes a grey monochrome rather than picking an arbitrary hue', () => {
    for (const grey of ['#808080', '#ffffff', '#000000']) {
      expect(customTheme(grey)!.chroma).toBeLessThan(0.02);
    }
  });

  it('carries the pick’s saturation through, so a dusty colour stays quiet', () => {
    const vivid = customTheme('#ff0000')!;
    const dusty = customTheme('#9b7f7f')!;
    expect(vivid.chroma).toBeGreaterThan(dusty.chroma * 2);
  });

  it('clamps a vivid pick so the ramp cannot clip', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#ff00ff']) {
      expect(customTheme(hex)!.chroma).toBeLessThanOrEqual(1.25);
    }
  });

  it('round-trips roughly to the hue of a known colour', () => {
    expect(customTheme('#4a9bcc')!.hue).toBeCloseTo(THEMES.steel.hue, -1);
  });

  it('accepts a hex with or without the hash and ignores case', () => {
    expect(customTheme('#D2783B')).toEqual(customTheme('d2783b'));
  });

  it('is not fooled by near-miss values', () => {
    for (const bad of ['#12345', '#1234567', 'red', 'rgb(1,2,3)', '#gggggg', '', null]) {
      expect(customTheme(bad), String(bad)).toBeNull();
    }
  });

  it('falls back to the default rather than throwing on junk', () => {
    expect(themeOf('#nothex')).toEqual(THEMES[DEFAULT_THEME]);
  });

  it('prefers a preset name over reading it as a colour', () => {
    expect(themeOf('copper')).toEqual(THEMES.copper);
  });

  it('seeds the colour input from whatever is stored', () => {
    expect(seedHex('#abcdef')).toBe('#abcdef');
    expect(seedHex('abcdef')).toBe('#abcdef');
    expect(seedHex('steel')).toBe(THEMES.steel.hex);
    expect(seedHex(undefined)).toBe(THEMES[DEFAULT_THEME].hex);
  });

  it('gives every preset a hex fallback matching its own hue', () => {
    for (const name of THEME_NAMES) {
      const fromHex = customTheme(THEMES[name].hex)!;
      if (THEMES[name].chroma < 0.2) continue; // a near-neutral has no stable hue
      expect(Math.abs(fromHex.hue - THEMES[name].hue), name).toBeLessThan(12);
    }
  });
});

/**
 * A custom property is substituted where it is DECLARED. If the accent ramp is
 * declared only on :root it computes once against :root's hue, descendants
 * inherit the finished colour, and a sheet setting --h deeper silently changes
 * nothing. This caught exactly that, after it shipped past unit tests, the type
 * checker and a build.
 */
describe('the accent ramp is declared where the hue is set', () => {
  // vitest runs from the project root; import.meta.url is not a file URL here.
  const css = readFileSync(resolve(process.cwd(), 'src/app.css'), 'utf8');

  it('declares the ramp on .themed as well as :root', () => {
    const block = css.slice(css.indexOf('--a-wash:'));
    const selector = css.slice(0, css.indexOf('--a-wash:')).split('}').pop() ?? '';
    expect(selector, 'ramp must be declared on .themed too').toContain('.themed');
    expect(block).toContain('--a:');
  });

  it('derives every accent shade from --h and --c rather than hard-coding one', () => {
    for (const token of ['--a-wash', '--a-edge', '--a-mid', '--a:', '--a-hi', '--danger:']) {
      const line = css.split('\n').find((l) => l.trim().startsWith(token));
      expect(line, `${token} should exist`).toBeTruthy();
      expect(line, `${token} must follow the theme`).toContain('var(--h)');
    }
  });
});
