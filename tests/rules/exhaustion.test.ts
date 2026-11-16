import { describe, expect, it } from 'vitest';
import { conditionsFor, d20Penalty, exhaustionLevel, exhaustionTracker, speedPenalty } from '$lib/rules/exhaustion';
import { speedParts } from '$lib/rules/derived';
import { PRESETS, presetsFor } from '$lib/rules/presets';
import { requestRoll, diceRequest, d20Penalty as penaltyStore } from '$lib/stores/dice';
import { get } from 'svelte/store';

const def = (trackers: unknown[] = []) => ({
  identity: { name: 'X', level: 5 }, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  proficiency: 3, combat: { ac: 10, speed: 30, hpMax: 10, hitDice: '5d8' }, saves: {}, skills: {},
  attacks: [], features: [], spells: [], trackers, equipment: [], currency: {}, notes: ''
}) as never;
const state = (over: Record<string, unknown> = {}) => ({ hpCurrent: 10, trackers: {}, conditions: [], ...over }) as never;
const tracker = { id: 't1', label: 'Exhaustion', max: 6, type: 'pips' };

describe('exhaustion', () => {
  it('reads the level from its tracker, else from a chip', () => {
    expect(exhaustionTracker(def([tracker]))?.id).toBe('t1');
    expect(exhaustionLevel(def([tracker]), state({ trackers: { t1: 3 } }))).toBe(3);
    expect(exhaustionLevel(def([tracker]), state({ trackers: { t1: 9 } }))).toBe(6);
    expect(exhaustionLevel(def(), state({ conditions: ['Poisoned', 'Exhaustion 2'] }))).toBe(2);
    expect(exhaustionLevel(def(), state({ conditions: ['exhaustion'] }))).toBe(1);
    expect(exhaustionLevel(def(), state())).toBe(0);
  });

  it('takes 2 from d20 tests and 5 feet from Speed a level', () => {
    expect(d20Penalty(3)).toBe(6);
    expect(speedPenalty(3)).toBe(15);
    const parts = speedParts(def(), 2);
    expect(parts.total).toBe(20);
    expect(parts.parts.at(-1)).toEqual({ label: 'Exhaustion 2', value: -10 });
    expect(speedParts(def(), 6).total).toBe(0);
    expect(speedParts(def()).total).toBe(30);
  });

  it('keeps one chip in its place, and marks level 6 Dead', () => {
    expect(conditionsFor(['Poisoned', 'Exhaustion 1', 'Prone'], 2)).toEqual(['Poisoned', 'Exhaustion 2', 'Prone']);
    expect(conditionsFor(['Poisoned'], 1)).toEqual(['Poisoned', 'Exhaustion 1']);
    expect(conditionsFor(['Exhaustion 3', 'Prone'], 0)).toEqual(['Prone']);
    expect(conditionsFor([], 6)).toEqual(['Exhaustion 6', 'Dead']);
    expect(conditionsFor(['Dead', 'Exhaustion 5'], 6)).toEqual(['Dead', 'Exhaustion 6']);
  });

  it('is a ready-made tracker for everyone, counting up, a level back each long rest', () => {
    const preset = PRESETS.find((p) => p.id === 'exhaustion')!;
    expect(presetsFor(['Fighter']).general.map((p) => p.id)).toEqual(['exhaustion']);
    const [t] = preset.build(1);
    expect(t).toMatchObject({ label: 'Exhaustion', max: 6, direction: 'accrue', reset: { on: 'long', amount: 1 } });
  });

  it('takes the penalty off d20 rolls only, while the sheet sets one', () => {
    penaltyStore.set({ amount: 4, why: 'Exhaustion 2' });
    requestRoll({ dice: { 20: 1 }, modifier: 5, mode: 'normal' } as never, 'Stealth');
    expect(get(diceRequest)).toMatchObject({ label: 'Stealth (Exhaustion 2 −4)', pool: { modifier: 1 } });
    requestRoll({ dice: { 8: 2 }, modifier: 3, mode: 'normal' } as never, 'Longsword damage');
    expect(get(diceRequest)).toMatchObject({ label: 'Longsword damage', pool: { modifier: 3 } });
    penaltyStore.set(null);
    requestRoll({ dice: { 20: 1 }, modifier: 5, mode: 'normal' } as never, 'Stealth');
    expect(get(diceRequest)).toMatchObject({ label: 'Stealth', pool: { modifier: 5 } });
  });
});
