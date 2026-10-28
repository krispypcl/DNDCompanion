/**
 * A character's theme is two numbers: a hue and a chroma scale. Every accent
 * shade is derived from them in oklch, so adding a theme costs one row here
 * rather than a hand-tuned palette, and a deliberately muted theme is possible
 * at all — hue alone cannot make a neutral, since the chroma would still be
 * there colouring it.
 *
 * A stored theme is either a preset name or a `#rrggbb` the player picked. A
 * picked colour is converted to the same two numbers, so its saturation carries
 * through: a dusty blue themes the sheet quietly, a vivid red does not.
 */

export type ThemeName =
  | 'slate'
  | 'sage'
  | 'ash'
  | 'copper'
  | 'blood'
  | 'verdigris'
  | 'arcane'
  | 'steel';

export type Theme = { label: string; hue: number; chroma: number };

/** `hex` is only a swatch fallback and the seed for the colour input; the
    rendered accent always comes from hue and chroma. */
export const THEMES: Record<ThemeName, Theme & { hex: string }> = {
  slate: { label: 'Slate', hue: 255, chroma: 0.45, hex: '#7994b7' },
  sage: { label: 'Sage', hue: 150, chroma: 0.45, hex: '#789d7f' },
  copper: { label: 'Copper', hue: 52, chroma: 1, hex: '#d2783b' },
  ash: { label: 'Ash', hue: 280, chroma: 0.14, hex: '#90919e' },
  blood: { label: 'Blood', hue: 22, chroma: 1.05, hex: '#db6b6a' },
  verdigris: { label: 'Verdigris', hue: 168, chroma: 0.85, hex: '#37a885' },
  arcane: { label: 'Arcane', hue: 300, chroma: 0.95, hex: '#9f7fd5' },
  steel: { label: 'Steel', hue: 238, chroma: 0.8, hex: '#4a9bcc' }
};

/** Soft and low-chroma: a new sheet should not arrive shouting. */
export const DEFAULT_THEME: ThemeName = 'slate';
export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

/** The chroma a picked colour needs to count as a full-strength accent. Above
    it the ramp would clip; a greyscale pick lands at 0 and themes monochrome. */
const FULL_CHROMA = 0.135;
const MAX_SCALE = 1.25;

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && value in THEMES;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value.trim());
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** sRGB hex to OKLCH. Returns null for anything that is not a six-digit hex. */
export function hexToOklch(hex: string): { l: number; c: number; h: number } | null {
  if (!isHexColor(hex)) return null;
  const n = parseInt(hex.trim().replace('#', ''), 16);
  const r = srgbToLinear(((n >> 16) & 255) / 255);
  const g = srgbToLinear(((n >> 8) & 255) / 255);
  const b = srgbToLinear((n & 255) / 255);

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.629978701 * b);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.hypot(A, B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

/** A theme from a picked colour, or null if the value is not a hex. */
export function customTheme(value: unknown): Theme | null {
  if (!isHexColor(value)) return null;
  const ok = hexToOklch(value);
  if (!ok) return null;
  return {
    label: 'Custom',
    hue: Math.round(ok.h * 10) / 10,
    chroma: Math.round(Math.min(ok.c / FULL_CHROMA, MAX_SCALE) * 1000) / 1000
  };
}

export function themeOf(value: unknown): Theme {
  if (isThemeName(value)) return THEMES[value];
  return customTheme(value) ?? THEMES[DEFAULT_THEME];
}

/**
 * An inline `style` value scoping a theme to one subtree. Returned as a string
 * rather than applied to :root so a campaign view can show several characters
 * in their own colours at once.
 */
export function themeStyle(value: unknown): string {
  const { hue, chroma } = themeOf(value);
  return `--h:${hue};--c:${chroma}`;
}

/** A swatch for the picker, in the same ramp position as the accent itself. */
export function swatchColor(name: ThemeName): string {
  const { hue, chroma } = THEMES[name];
  return `oklch(66% calc(0.135 * ${chroma}) ${hue})`;
}

/** What the colour input should open on, given whatever is stored. */
export function seedHex(value: unknown): string {
  if (isHexColor(value)) return value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return THEMES[isThemeName(value) ? value : DEFAULT_THEME].hex;
}
