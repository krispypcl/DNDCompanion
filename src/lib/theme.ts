/**
 * A character's theme is two numbers: a hue and a chroma scale. Every accent
 * shade is derived from them in oklch, so adding a theme costs one row here
 * rather than a hand-tuned palette, and a deliberately muted theme is possible
 * at all — hue alone cannot make a neutral, since the chroma would still be
 * there colouring it.
 */

export type ThemeName = 'copper' | 'ash' | 'blood' | 'verdigris' | 'arcane' | 'steel';

export type Theme = { label: string; hue: number; chroma: number };

export const THEMES: Record<ThemeName, Theme> = {
  copper: { label: 'Copper', hue: 52, chroma: 1 },
  ash: { label: 'Ash', hue: 280, chroma: 0.14 },
  blood: { label: 'Blood', hue: 22, chroma: 1.05 },
  verdigris: { label: 'Verdigris', hue: 168, chroma: 0.85 },
  arcane: { label: 'Arcane', hue: 300, chroma: 0.95 },
  steel: { label: 'Steel', hue: 238, chroma: 0.8 }
};

export const DEFAULT_THEME: ThemeName = 'copper';

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && value in THEMES;
}

export function themeOf(name: unknown): Theme {
  return THEMES[isThemeName(name) ? name : DEFAULT_THEME];
}

/**
 * An inline `style` value scoping a theme to one subtree. Returned as a string
 * rather than applied to :root so a campaign view can show several characters
 * in their own colours at once.
 */
export function themeStyle(name: unknown): string {
  const { hue, chroma } = themeOf(name);
  return `--h:${hue};--c:${chroma}`;
}

/** A swatch for the picker, in the same ramp position as the accent itself. */
export function swatchColor(name: ThemeName): string {
  const { hue, chroma } = THEMES[name];
  return `oklch(66% calc(0.135 * ${chroma}) ${hue})`;
}
