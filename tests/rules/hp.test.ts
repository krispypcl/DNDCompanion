import { describe, expect, test } from 'vitest';
import { applyDamage, applyHealing, changeHp, setTempHp } from '#lib/rules/hp.ts';
import { emptyState, type State } from '#lib/types.ts';

const at = (hpCurrent: number, hpTemp = 0): State => ({ ...emptyState(), hpCurrent, hpTemp });
const MAX = 40;

describe('applyDamage', () => {
  test('reduces current HP', () => {
    expect(applyDamage(at(40), 5, MAX).hpCurrent).toBe(35);
  });

  // Review Focus 1
  test('damage below zero clamps to zero', () => {
    expect(applyDamage(at(3), 50, MAX).hpCurrent).toBe(0);
  });

  test('temp HP absorbs damage first', () => {
    const result = applyDamage(at(40, 10), 6, MAX);
    expect(result.hpTemp).toBe(4);
    expect(result.hpCurrent).toBe(40);
  });

  test('damage exceeding temp HP spills into current HP', () => {
    const result = applyDamage(at(40, 10), 15, MAX);
    expect(result.hpTemp).toBe(0);
    expect(result.hpCurrent).toBe(35);
  });

  test('damage exactly equal to temp HP leaves current HP untouched', () => {
    const result = applyDamage(at(40, 10), 10, MAX);
    expect(result.hpTemp).toBe(0);
    expect(result.hpCurrent).toBe(40);
  });

  test('zero and negative amounts change nothing', () => {
    expect(applyDamage(at(40), 0, MAX)).toEqual(at(40));
    expect(applyDamage(at(40), -5, MAX)).toEqual(at(40));
  });
});

describe('applyHealing', () => {
  test('restores current HP', () => {
    expect(applyHealing(at(20), 5, MAX).hpCurrent).toBe(25);
  });

  // Review Focus 1
  test('healing above max clamps to max', () => {
    expect(applyHealing(at(38), 50, MAX).hpCurrent).toBe(MAX);
  });

  test('healing from zero works', () => {
    expect(applyHealing(at(0), 7, MAX).hpCurrent).toBe(7);
  });

  test('healing does not touch temp HP', () => {
    expect(applyHealing(at(20, 8), 5, MAX).hpTemp).toBe(8);
  });

  test('healing clears death saves', () => {
    const downed: State = { ...at(0), deathSaves: { successes: 2, failures: 1 } };
    expect(applyHealing(downed, 1, MAX).deathSaves).toEqual({ successes: 0, failures: 0 });
  });
});

describe('setTempHp', () => {
  test('temp HP does not stack, the higher value wins', () => {
    expect(setTempHp(at(40, 10), 6).hpTemp).toBe(10);
    expect(setTempHp(at(40, 10), 14).hpTemp).toBe(14);
  });

  test('negative temp HP is treated as none', () => {
    expect(setTempHp(at(40, 0), -3).hpTemp).toBe(0);
  });
});

describe('changeHp (the campaign card quick buttons)', () => {
  test('damage takes temp first, heal tops up, temp keeps the larger pool', () => {
    expect(changeHp(at(30, 5), 'damage', 8, MAX)).toMatchObject({ hpCurrent: 27, hpTemp: 0 });
    expect(changeHp(at(30), 'heal', 20, MAX).hpCurrent).toBe(MAX);
    expect(changeHp(at(30, 6), 'temp', 4, MAX).hpTemp).toBe(6);
  });

  test('what follows from it, as on the sheet: down at 0, up again on healing', () => {
    const down = changeHp(at(5), 'damage', 9, MAX);
    expect(down.hpCurrent).toBe(0);
    expect(down.conditions.map((c) => c.toLowerCase())).toContain('incapacitated');
    const up = changeHp(down, 'heal', 3, MAX);
    expect(up.hpCurrent).toBe(3);
    expect(up.conditions.map((c) => c.toLowerCase())).not.toContain('incapacitated');
  });
});
