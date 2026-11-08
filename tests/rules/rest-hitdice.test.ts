import { describe, expect, it } from 'vitest';
import { healFromHitDice, hitDiceLeft, hitDiceOf, hitDicePool } from '$lib/rules/rest';

const def = (hitDice: string, con = 14) => ({
  identity: { name: 'X', level: 7 }, abilities: { str: 10, dex: 10, con, int: 10, wis: 10, cha: 10 },
  combat: { ac: 10, speed: 30, hpMax: 50, hitDice }, saves: {}, skills: {}, trackers: []
}) as never;
const state = (used = 0, hp = 20) => ({ hpCurrent: hp, hpTemp: 0, hitDiceUsed: used, trackers: {} }) as never;

describe('short rest hit dice', () => {
  it('reads one or several kinds of hit dice, largest first', () => {
    expect(hitDiceOf(def('7d10'))).toEqual([{ sides: 10, count: 7 }]);
    expect(hitDiceOf(def('2d8 + 5d10'))).toEqual([{ sides: 10, count: 5 }, { sides: 8, count: 2 }]);
    expect(hitDiceOf(def('3'))).toEqual([{ sides: 8, count: 3 }]);
  });
  it('spends the largest unspent first, with Constitution on each', () => {
    expect(hitDicePool(def('5d10 + 2d8'), state(4), 3)).toEqual({ dice: { 10: 1, 8: 2 }, modifier: 6, mode: 'normal' });
    expect(hitDicePool(def('5d10'), state(5), 1)).toBeNull();
    expect(hitDiceLeft(def('5d10 + 2d8'), state(4))).toBe(3);
  });
  it('heals up to full and counts the dice spent', () => {
    expect(healFromHitDice(def('7d10'), state(0, 45), 2, 14)).toMatchObject({ hpCurrent: 50, hitDiceUsed: 2 });
    expect(healFromHitDice(def('7d10'), state(1, 20), 1, -1)).toMatchObject({ hpCurrent: 20, hitDiceUsed: 2 });
  });
});
