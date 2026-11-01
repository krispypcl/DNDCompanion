import { describe, expect, it } from 'vitest';
import { PAGE_BREAK, addPage, isBlank, joinPages, removePage, setPage, splitPages } from '$lib/rules/pages';

describe('pages', () => {
  it('reads writing from before pages as one page', () => {
    expect(splitPages('Once upon a time')).toEqual(['Once upon a time']);
    expect(splitPages('')).toEqual(['']);
    expect(splitPages(undefined)).toEqual(['']);
  });

  it('round-trips', () => {
    const pages = ['one\ntwo', '', 'three'];
    expect(splitPages(joinPages(pages))).toEqual(pages);
  });

  it('adds a blank page after the one you are on', () => {
    expect(addPage(['a', 'b'], 0)).toEqual(['a', '', 'b']);
    expect(addPage(['a', 'b'], 1)).toEqual(['a', 'b', '']);
  });

  it('removes a page, but never the last one', () => {
    expect(removePage(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(removePage(['a'], 0)).toEqual(['']);
  });

  it('cannot be split by what is typed', () => {
    expect(setPage(['a', 'b'], 0, `x${PAGE_BREAK}y`)).toEqual(['xy', 'b']);
  });

  it('knows an empty book', () => {
    expect(isBlank(['', '  '])).toBe(true);
    expect(isBlank(['', 'x'])).toBe(false);
  });
});
