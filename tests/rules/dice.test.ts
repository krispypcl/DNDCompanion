import { describe, expect, it } from 'vitest';
import { MAX_DICE, addDie, fairRng, formula, roll, type Pool } from '$lib/rules/dice';

const empty = (): Pool => ({ dice: {}, modifier: 0, mode: 'normal' });
/** Hands out the given faces in order. */
const scripted = (...faces: number[]) => () => faces.shift() ?? 1;

describe('dice', () => {
  it('builds a pool and says it as a table would', () => {
    let p = addDie(addDie(addDie(empty(), 6), 6), 20);
    p = { ...p, modifier: 3 };
    expect(formula(p)).toBe('1d20 + 2d6 + 3');
    expect(formula({ ...p, modifier: -2 })).toBe('1d20 + 2d6 − 2');
    expect(formula({ ...p, mode: 'advantage' })).toBe('1d20 + 2d6 + 3, advantage');
    expect(formula(empty())).toBe('');
  });

  it('removes a die type when its count reaches zero', () => {
    expect(addDie(addDie(empty(), 8), 8, -1).dice).toEqual({});
  });

  it('caps the pool', () => {
    let p = empty();
    for (let i = 0; i < MAX_DICE + 5; i++) p = addDie(p, 6);
    expect(p.dice[6]).toBe(MAX_DICE);
  });

  it('adds the dice and the modifier', () => {
    const r = roll({ dice: { 6: 2 }, modifier: 3, mode: 'normal' }, scripted(4, 5));
    expect(r.dice.map((d) => d.value)).toEqual([4, 5]);
    expect(r.total).toBe(12);
  });

  it('keeps the higher d20 with advantage and the lower with disadvantage', () => {
    const adv = roll({ dice: { 20: 1 }, modifier: 0, mode: 'advantage' }, scripted(7, 15));
    expect(adv.dice[0]).toEqual({ sides: 20, value: 15, dropped: 7 });
    const dis = roll({ dice: { 20: 1 }, modifier: 0, mode: 'disadvantage' }, scripted(7, 15));
    expect(dis.dice[0]).toEqual({ sides: 20, value: 7, dropped: 15 });
  });

  it('applies advantage to d20s only', () => {
    const r = roll({ dice: { 20: 1, 6: 1 }, modifier: 0, mode: 'advantage' }, scripted(2, 18, 4));
    expect(r.dice).toEqual([{ sides: 20, value: 18, dropped: 2 }, { sides: 6, value: 4 }]);
    expect(r.total).toBe(22);
  });

  it('rolls fairly within range', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = fairRng(6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });
});
