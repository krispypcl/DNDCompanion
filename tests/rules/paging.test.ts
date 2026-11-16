import { describe, expect, it } from 'vitest';
import { paginate } from '$lib/rules/paging';

const group = (key: string, n: number, label = key) => ({ key, label, items: Array.from({ length: n }, (_, i) => `${key}${i}`) });
const shape = (pages: { key: string; items: string[] }[][]) => pages.map((p) => p.map((g) => `${g.key}:${g.items.length}`).join(' '));
// Rows of 100px, names of 30px, two to a row.
const size = (room: number) => ({ room, rowH: 100, nameH: 30, cols: 2 });

describe('paginate', () => {
  it('fills a page with whole rows, a group starting a row of its own', () => {
    // 330px: one name and three rows; with a pinned card, two names and two rows.
    expect(shape(paginate([group('rest', 9, '')], size(330)))).toEqual(['rest:6', 'rest:3']);
    expect(shape(paginate([group('pin', 1), group('rest', 9)], size(330)))).toEqual(['pin:1 rest:2', 'rest:6', 'rest:1']);
  });
  it('a group without a name takes no room for one', () => {
    expect(shape(paginate([group('rest', 6, '')], size(300)))).toEqual(['rest:6']);
    expect(shape(paginate([group('rest', 6)], size(300)))).toEqual(['rest:4', 'rest:2']);
  });
  it('moves a group to the next page when its name and a row do not fit', () => {
    expect(shape(paginate([group('pin', 4), group('old', 2)], size(260)))).toEqual(['pin:4', 'old:2']);
  });
  it('always holds a row, and gives at least one page', () => {
    expect(shape(paginate([group('rest', 3)], size(10)))).toEqual(['rest:2', 'rest:1']);
    expect(paginate([group('rest', 0)], size(300))).toEqual([[]]);
  });
});
