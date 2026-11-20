import { describe, expect, it } from 'vitest';
import {
  canSettle, next, ordered, previous, rollInitiative, settleAll, settleOrder, settleScores, start, unsettled, type Combatant, type InitiativeRow
} from '#lib/rules/initiative.ts';

const c = (key: string, value: number | null, dex = 0): Combatant => ({ key, name: key, value, dex, side: key.startsWith('pc') ? 'pc' : 'creature' });
const list = [c('cr:goblin', 12, 2), c('pc:loka', 17), c('pc:nyx', 12, 3), c('cr:boss', null)];

describe('initiative', () => {
  it('orders highest first, Dexterity breaking ties, the unrolled last', () => {
    expect(ordered(list).map((x) => x.key)).toEqual(['pc:loka', 'pc:nyx', 'cr:goblin', 'cr:boss']);
  });
  it('starts at the top of round 1 and goes round', () => {
    let t = start(list);
    expect(t).toEqual({ turn: 'pc:loka', round: 1 });
    t = next(list, t);
    t = next(list, t);
    expect(t).toEqual({ turn: 'cr:goblin', round: 1 });
    t = next(list, t);
    expect(t).toEqual({ turn: 'pc:loka', round: 2 });
    expect(previous(list, t)).toEqual({ turn: 'cr:goblin', round: 1 });
    expect(previous(list, { turn: 'pc:loka', round: 1 })).toEqual({ turn: 'pc:loka', round: 1 });
  });
  it('has no turns while nobody has rolled', () => {
    expect(start([c('cr:boss', null)])).toEqual({ turn: null, round: 0 });
  });
  it('rolls a d20 and adds the bonus', () => {
    expect(rollInitiative(3, () => 11)).toBe(14);
  });
});

describe('ties settled by hand', () => {
  // Three on 15: Ash (dex 3), the goblin (dex 2), Bree (dex 1); the boss on 9.
  const rows: InitiativeRow[] = [
    { key: 'pc:ash', name: 'Ash', value: 15, dex: 3, side: 'pc', mine: true },
    { key: 'cr:gob', name: 'Goblin', value: 15, dex: 2, side: 'creature' },
    { key: 'pc:bree', name: 'Bree', value: 15, dex: 1, side: 'pc' },
    { key: 'cr:boss', name: 'Boss', value: 9, dex: 5, side: 'creature' }
  ];
  const keys = (l: Combatant[]) => ordered(l).map((x) => x.key);

  it('lets a settled score stand in for Dexterity', () => {
    expect(keys(rows)).toEqual(['pc:ash', 'cr:gob', 'pc:bree', 'cr:boss']);
    expect(keys(rows.map((r) => (r.key === 'pc:bree' ? { ...r, tie: 9 } : r)))).toEqual(['pc:bree', 'pc:ash', 'cr:gob', 'cr:boss']);
  });

  it('lets the DM move creatures and a player only their own character', () => {
    expect(canSettle(rows, 'cr:gob', true)).toBe(true);
    expect(canSettle(rows, 'pc:ash', true)).toBe(false);
    expect(canSettle(rows, 'cr:boss', true)).toBe(false);
    expect(canSettle(rows, 'pc:ash', false)).toBe(true);
    expect(canSettle(rows, 'pc:bree', false)).toBe(false);
  });

  it('keeps a drag inside its tie', () => {
    expect(settleOrder(rows, 'cr:gob', ['cr:gob', 'pc:ash', 'pc:bree', 'cr:boss'], true)).toEqual(['cr:gob', 'pc:ash', 'pc:bree', 'cr:boss']);
    expect(settleOrder(rows, 'cr:gob', ['pc:ash', 'pc:bree', 'cr:boss', 'cr:gob'], true)).toBeNull();
  });

  it('swaps a player’s characters among the characters’ places, the creature staying put', () => {
    const order = settleOrder(rows, 'pc:ash', ['cr:gob', 'pc:bree', 'pc:ash', 'cr:boss'], false)!;
    expect(order).toEqual(['pc:bree', 'cr:gob', 'pc:ash', 'cr:boss']);
    const ties = settleScores(rows, 'pc:ash', order, false);
    expect(Object.keys(ties).sort()).toEqual(['pc:ash', 'pc:bree']);
    expect(keys(rows.map((r) => ({ ...r, tie: ties[r.key] ?? r.tie })))).toEqual(order);
  });

  it('numbers the whole tie for the DM, and every tie at the start', () => {
    const order = ['cr:gob', 'pc:ash', 'pc:bree', 'cr:boss'];
    const ties = settleScores(rows, 'cr:gob', order, true);
    expect(ties).toEqual({ 'cr:gob': 3, 'pc:ash': 2, 'pc:bree': 1 });
    expect(keys(rows.map((r) => ({ ...r, tie: ties[r.key] })))).toEqual(order);
    expect(settleAll(rows)).toEqual({ 'pc:ash': 3, 'cr:gob': 2, 'pc:bree': 1 });
  });

  it('numbers a fresh tie once, then leaves it', () => {
    expect(unsettled(rows)).toEqual({ 'pc:ash': 3, 'cr:gob': 2, 'pc:bree': 1 });
    const kept = rows.map((r) => ({ ...r, tie: ({ 'pc:ash': 3, 'cr:gob': 2, 'pc:bree': 1 } as Record<string, number>)[r.key] }));
    expect(unsettled(kept)).toBeNull();
  });

  it('keeps the creature put when a player swaps characters in a numbered tie', () => {
    const numbered = rows.map((r) => ({ ...r, dex: 0, tie: ({ 'pc:ash': 3, 'cr:gob': 2, 'pc:bree': 1 } as Record<string, number>)[r.key] }));
    const order = settleOrder(numbered, 'pc:ash', ['cr:gob', 'pc:bree', 'pc:ash', 'cr:boss'], false)!;
    const ties = settleScores(numbered, 'pc:ash', order, false);
    expect(keys(numbered.map((r) => ({ ...r, tie: ties[r.key] ?? r.tie })))).toEqual(['pc:bree', 'cr:gob', 'pc:ash', 'cr:boss']);
  });
});

describe('rollInitiative with advantage', () => {
  it('keeps the higher of two d20s', () => {
    const dice = [4, 17];
    const die = () => dice.shift()!;
    expect(rollInitiative(2, die, true)).toBe(19);
  });
  it('rolls once without it', () => {
    let n = 0;
    expect(rollInitiative(1, () => (n++, 8))).toBe(9);
    expect(n).toBe(1);
  });
});
