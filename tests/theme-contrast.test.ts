/**
 * The light ramp is a set of numbers that have to hold up against every
 * preset accent, and nothing in a render test would notice if one stopped.
 * These read the tokens out of app.css, convert OKLCH to sRGB, and check the
 * pairs a reader actually has to resolve.
 *
 * The conversion clips each channel into gamut, which is the worst case: a
 * browser gamut-maps instead, keeping lightness and giving up chroma, so a
 * pair that clears the threshold here clears it on screen too.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { THEMES } from '$lib/theme';

const css = readFileSync('src/app.css', 'utf8');

/** Every (hue, chroma) an accent can take: the presets, and a custom colour
    picked at the top of the scale. */
const ACCENTS: [string, number, number][] = [
  ...Object.entries(THEMES).map(([name, t]) => [name, t.hue, t.chroma] as [string, number, number]),
  ['custom at full chroma', 20, 1.25]
];

function block(selector: string): string {
  const at = css.indexOf(selector);
  expect(at, `${selector} should be in app.css`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
}

/** Reads `--name: oklch(L% <chroma> <hue>)`, where the chroma may be a calc
    over --c and the hue may be --h, and resolves it for one accent. */
function token(
  source: string,
  name: string,
  chromaScale: number,
  hue: number
): [number, number, number] {
  const at = source.indexOf(`--${name}:`);
  expect(at, `--${name} should be declared`).toBeGreaterThan(-1);
  const open = source.indexOf('oklch(', at) + 'oklch('.length;

  // calc() nests, so the closing bracket has to be counted rather than found.
  let depth = 0;
  let end = open;
  for (; end < source.length; end++) {
    const ch = source[end];
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) break;
      depth--;
    }
  }
  const body = source.slice(open, end).trim();

  // Split on spaces that are not inside brackets: "46% calc(0.13 * var(--c)) var(--h)".
  const parts: string[] = [];
  let current = '';
  depth = 0;
  for (const ch of body) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ' ' && depth === 0) {
      if (current) parts.push(current);
      current = '';
    } else current += ch;
  }
  if (current) parts.push(current);
  expect(parts.length, `--${name} should read as L C H`).toBe(3);

  const lightness = Number(parts[0].replace('%', '')) / 100;
  const calc = parts[1].match(/calc\(([\d.]+)\s*\*\s*var\(--c\)\)/);
  const chroma = calc ? Number(calc[1]) * chromaScale : Number(parts[1]);
  const hueValue = parts[2] === 'var(--h)' ? hue : Number(parts[2]);
  return [lightness, chroma, hueValue];
}

function toRgb([L, C, hDeg]: [number, number, number]): number[] {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ].map((v) => Math.min(1, Math.max(0, v)));
}

const contrast = (fg: number[], bg: number[]) => {
  const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** fg, bg, the least it may be. 4.5 is the readable threshold for text; the
    lower ones are edges and hairlines, which only have to be visible. */
const PAIRS: [string, string, number][] = [
  ['text', 'bg', 4.5],
  ['text', 'surface', 4.5],
  ['text', 'raised', 4.5],
  ['dim', 'surface', 4.5],
  ['dim', 'bg', 4.5],
  ['label', 'surface', 4.5],
  ['faint', 'surface', 3],
  ['a', 'surface', 4.5],
  ['a-hi', 'surface', 4.5],
  ['a-hi', 'raised', 4.5],
  ['a', 'a-wash', 4.5],
  ['a-mid', 'surface', 3],
  ['a-edge', 'surface', 1.6],
  ['line', 'surface', 1.2]
];

/**
 * Danger is held to a different number in each mode, and deliberately.
 *
 * In light it is a colour written for this work, so it clears the 4.5:1 text
 * threshold against every accent. In dark it is the colour the sheet has
 * shipped with: it lands between 4.03 and 5.15 depending on the accent, under
 * the threshold for the stronger hues. Raising it would mean recolouring a
 * dark palette nobody asked to change, so it is pinned where it is and the
 * number here says what it actually achieves rather than what one would want.
 * It is only ever a delete glyph and a confirm button, never body text.
 */
const DANGER: Record<string, number> = { dark: 4, light: 4.5 };

const MODES = {
  dark: { neutrals: ':root {', ramp: ':root,\n.themed {' },
  light: { neutrals: ":root[data-mode='light'] {", ramp: ":root[data-mode='light'],\n[data-mode='light'] .themed {" }
};

describe.each(Object.entries(MODES))('%s mode contrast', (name, where) => {
  const neutrals = block(where.neutrals);
  const ramp = block(where.ramp);

  it.each(ACCENTS)('holds up for %s', (_accent, hue, chromaScale) => {
    const colour = (n: string) =>
      toRgb(token(ramp.includes(`--${n}:`) ? ramp : neutrals, n, chromaScale, hue));
    for (const [fg, bg, min] of [...PAIRS, ['danger', 'surface', DANGER[name]] as [string, string, number]]) {
      const ratio = contrast(colour(fg), colour(bg));
      expect(
        Number(ratio.toFixed(2)),
        `${name}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${min}:1`
      ).toBeGreaterThanOrEqual(min);
    }
  });
});

describe('the two modes stay in step', () => {
  it('defines every neutral in light that dark defines', () => {
    const names = (source: string) => [...source.matchAll(/--([a-z-]+):/g)].map((m) => m[1]).sort();
    const dark = names(block(':root {')).filter((n) => !['h', 'c', 'r', 'r-sm'].includes(n));
    const light = names(block(MODES.light.neutrals));
    expect(light).toEqual(expect.arrayContaining(dark));
  });

  it('defines every accent shade in light that dark defines', () => {
    const names = (source: string) =>
      [...source.matchAll(/--([a-z-]+):/g)].map((m) => m[1]).filter((n) => !n.startsWith('hover'));
    const dark = names(block(MODES.dark.ramp)).filter((n) => !['accent', 'good', 'bad'].includes(n));
    const light = names(block(MODES.light.ramp));
    expect(light).toEqual(expect.arrayContaining(dark));
  });
});
