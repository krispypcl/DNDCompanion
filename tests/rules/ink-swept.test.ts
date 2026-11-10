import { describe, expect, it } from 'vitest';
import { swept } from '$lib/rules/ink';

describe('swept', () => {
  const lines = [
    { p: [0, 0, 100, 0], w: 4 }, // across the top
    { p: [0, 50, 100, 50], w: 4 }, // across the middle
    { p: [200, 200, 200.5, 200.5], w: 6 }, // a dot
    { p: [0, 100, 50, 100, 100, 100], w: 2 } // across the bottom, in two pieces
  ];
  it('takes every line a swipe crosses', () => {
    expect(swept(lines, [50, -10], [50, 120], 2)).toEqual([0, 1, 3]);
  });
  it('leaves lines the swipe passes by', () => {
    expect(swept(lines, [150, -10], [150, 120], 2)).toEqual([]);
  });
  it('counts a line touched by its thickness', () => {
    expect(swept(lines, [10, 3.5], [90, 3.5], 2)).toEqual([0]);
    expect(swept(lines, [10, 9], [90, 9], 2)).toEqual([]);
  });
  it('takes a dot under a tap', () => {
    expect(swept(lines, [201, 201], [201, 201], 2)).toEqual([2]);
  });
});
