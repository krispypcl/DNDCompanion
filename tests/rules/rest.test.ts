import { describe, expect, test } from 'vitest';
import { applyRest } from '$lib/rules/rest';
import { emptyState, type Definition, type State, type Tracker } from '$lib/types';

const tracker = (over: Partial<Tracker> & { id: string }): Tracker => ({
  label: over.id,
  max: 4,
  type: 'pips',
  direction: 'spend',
  reset: { on: 'short', amount: 'full' },
  ...over
});

const def = (trackers: Tracker[]): Definition =>
  ({
    identity: { name: 'T', level: 5 },
    abilities: { str: 10, dex: 18, con: 16, int: 8, wis: 14, cha: 18 },
    proficiency: 3,
    combat: { ac: 16, speed: 30, hpMax: 40, hitDice: '5d8' },
    saves: {},
    skills: {},
    attacks: [],
    features: [],
    spells: [],
    trackers,
    equipment: [],
    currency: {},
    notes: ''
  }) as Definition;

const spentState = (trackers: Record<string, number>, over: Partial<State> = {}): State => ({
  ...emptyState(),
  hpCurrent: 12,
  hpTemp: 7,
  hitDiceUsed: 3,
  trackers,
  ...over
});

describe('applyRest', () => {
  const risk = tracker({ id: 'risk', reset: { on: 'short', amount: 'full' } });
  const star = tracker({ id: 'star', max: 3, reset: { on: 'dawn', amount: 'full' } });
  const slots = tracker({ id: 'slots', reset: { on: 'long', amount: 'full' } });
  const manual = tracker({ id: 'manual', reset: { on: 'manual', amount: 'full' } });

  const d = def([risk, star, slots, manual]);
  const s = spentState({ risk: 3, star: 2, slots: 4, manual: 2 });

  test('short rest refills only short trackers', () => {
    const next = applyRest(d, s, 'short');
    expect(next.trackers).toEqual({ risk: 0, star: 2, slots: 4, manual: 2 });
  });

  test('long rest refills short, long and dawn trackers', () => {
    const next = applyRest(d, s, 'long');
    expect(next.trackers).toEqual({ risk: 0, star: 0, slots: 0, manual: 2 });
  });

  test('dawn refills only dawn trackers', () => {
    const next = applyRest(d, s, 'dawn');
    expect(next.trackers).toEqual({ risk: 3, star: 0, slots: 4, manual: 2 });
  });

  test('manual trackers are never touched by any rest', () => {
    for (const kind of ['short', 'long', 'dawn'] as const) {
      expect(applyRest(d, s, kind).trackers.manual).toBe(2);
    }
  });

  test('a partial reset restores that many, not all', () => {
    const exhaustion = tracker({
      id: 'ex',
      max: 6,
      direction: 'accrue',
      reset: { on: 'long', amount: 1 }
    });
    const next = applyRest(def([exhaustion]), spentState({ ex: 3 }), 'long');
    expect(next.trackers.ex).toBe(2);
  });

  test('a formula reset amount evaluates', () => {
    const recovery = tracker({ id: 'arc', max: 9, reset: { on: 'short', amount: 'level/2' } });
    const next = applyRest(def([recovery]), spentState({ arc: 9 }), 'short');
    expect(next.trackers.arc).toBe(7); // level 5 → restores 2
  });

  test('a partial reset never drops below zero', () => {
    const t = tracker({ id: 'p', max: 4, reset: { on: 'short', amount: 10 } });
    const next = applyRest(def([t]), spentState({ p: 2 }), 'short');
    expect(next.trackers.p).toBe(0);
  });

  test('long rest restores HP to max and clears temp HP', () => {
    const next = applyRest(d, s, 'long');
    expect(next.hpCurrent).toBe(40);
    expect(next.hpTemp).toBe(0);
  });

  test('long rest clears death saves', () => {
    const downed = spentState({}, { deathSaves: { successes: 1, failures: 2 } });
    expect(applyRest(d, downed, 'long').deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  test('short rest leaves HP and temp HP alone', () => {
    const next = applyRest(d, s, 'short');
    expect(next.hpCurrent).toBe(12);
    expect(next.hpTemp).toBe(7);
  });

  test('long rest restores half the hit dice, rounded down, at least one', () => {
    expect(applyRest(d, s, 'long').hitDiceUsed).toBe(1); // 5d8 → regain 2 of 3 used
  });

  test('an unparseable reset amount leaves that tracker untouched', () => {
    const bad = tracker({ id: 'bad', reset: { on: 'short', amount: 'wisdom' } });
    expect(applyRest(def([bad]), spentState({ bad: 2 }), 'short').trackers.bad).toBe(2);
  });
});
