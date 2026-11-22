import { beforeEach, describe, expect, it } from 'vitest';
import { rememberThemes, rememberedTheme } from '#lib/themeMemory.ts';

describe('themeMemory (a page loads in the colors it was last seen in)', () => {
  beforeEach(() => localStorage.clear());

  it('keeps each theme seen and gives it back', () => {
    rememberThemes([['sheet-1', 'steel'], ['camp-1', 'copper']]);
    expect(rememberedTheme('sheet-1')).toBe('steel');
    expect(rememberedTheme('camp-1')).toBe('copper');
    expect(rememberedTheme('nobody')).toBeUndefined();
  });

  it('takes a change, and skips what is not a theme', () => {
    rememberThemes([['sheet-1', 'steel']]);
    rememberThemes([['sheet-1', 'arcane'], ['sheet-2', undefined], ['', 'blood']]);
    expect(rememberedTheme('sheet-1')).toBe('arcane');
    expect(rememberedTheme('sheet-2')).toBeUndefined();
  });

  it('lets the oldest go once it holds 200', () => {
    rememberThemes(Array.from({ length: 205 }, (_, i) => [`s${i}`, 'sage'] as [string, unknown]));
    expect(rememberedTheme('s0')).toBeUndefined();
    expect(rememberedTheme('s204')).toBe('sage');
  });

  it('shrugs off a broken store', () => {
    localStorage.setItem('dndcompanion:themes', '{not json');
    expect(rememberedTheme('sheet-1')).toBeUndefined();
    rememberThemes([['sheet-1', 'slate']]);
    expect(rememberedTheme('sheet-1')).toBe('slate');
  });
});
