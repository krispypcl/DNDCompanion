import { describe, expect, test } from 'vitest';
import { clampSpent, trackerMax } from '#lib/rules/tracker.ts';
import type { FormulaContext } from '#lib/rules/formula.ts';
import type { Tracker } from '#lib/types.ts';

const ctx: FormulaContext = { level: 5, classlevel: 5, prof: 3, str: 1, dex: 4, con: 3, int: -1, wis: 2, cha: 4 };

const tracker = (over: Partial<Tracker> = {}): Tracker => ({
  id: 't',
  label: 'Risk Dice',
  max: 4,
  type: 'pips',
  direction: 'spend',
  reset: { on: 'short', amount: 'full' },
  ...over
});

describe('trackerMax', () => {
  test('a numeric max passes through', () => {
    expect(trackerMax(tracker({ max: 4 }), ctx)).toBe(4);
  });

  test('a formula max evaluates', () => {
    expect(trackerMax(tracker({ max: 'level' }), ctx)).toBe(5);
    expect(trackerMax(tracker({ max: 'cha' }), ctx)).toBe(4);
    expect(trackerMax(tracker({ max: 'level/2' }), ctx)).toBe(2);
  });

  test('an invalid formula throws rather than reading zero', () => {
    expect(() => trackerMax(tracker({ max: 'wisdom' }), ctx)).toThrow();
  });

  test('a negative result floors at zero', () => {
    expect(trackerMax(tracker({ max: 'int-1' }), ctx)).toBe(0);
  });
});

describe('clampSpent', () => {
  // Review Focus 2: a level drop shrinks the max under what is already spent.
  test('spent is clamped when the max shrinks', () => {
    expect(clampSpent(4, 2)).toBe(2);
  });

  test('spent never goes negative', () => {
    expect(clampSpent(-3, 4)).toBe(0);
  });

  test('a spent count within range is untouched', () => {
    expect(clampSpent(2, 4)).toBe(2);
  });
});
