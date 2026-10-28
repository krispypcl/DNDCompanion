import { beforeEach, describe, expect, test } from 'vitest';
import { get } from 'svelte/store';
import { canUndo, lastLabel, resetUndo, snapshot, undo } from '$lib/stores/undo';
import { emptyState, type State } from '$lib/types';

const stateWithHp = (hp: number): State => ({ ...emptyState(), hpCurrent: hp });

describe('undo stack', () => {
  beforeEach(() => resetUndo());

  test('undo returns the state that was snapshotted', () => {
    snapshot(stateWithHp(40), 'Damage');
    expect(undo()?.state.hpCurrent).toBe(40);
  });

  test('undo returns null when the stack is empty', () => {
    expect(undo()).toBeNull();
  });

  test('undo returns the label it was snapshotted with', () => {
    snapshot(stateWithHp(40), 'Long rest');
    expect(undo()?.label).toBe('Long rest');
  });

  test('entries come back in reverse order', () => {
    snapshot(stateWithHp(40), 'first');
    snapshot(stateWithHp(30), 'second');
    expect(undo()?.label).toBe('second');
    expect(undo()?.label).toBe('first');
    expect(undo()).toBeNull();
  });

  test('the stack holds at most ten entries', () => {
    for (let i = 0; i < 10; i += 1) snapshot(stateWithHp(i), `s${i}`);
    for (let i = 9; i >= 0; i -= 1) expect(undo()?.label).toBe(`s${i}`);
    expect(undo()).toBeNull();
  });

  test('the eleventh snapshot evicts the oldest', () => {
    for (let i = 0; i < 11; i += 1) snapshot(stateWithHp(i), `s${i}`);
    const labels: string[] = [];
    for (let entry = undo(); entry; entry = undo()) labels.push(entry.label);
    expect(labels).toHaveLength(10);
    expect(labels).not.toContain('s0');
    expect(labels.at(-1)).toBe('s1');
  });

  test('snapshots are deep copies, not references', () => {
    const live = stateWithHp(40);
    snapshot(live, 'Damage');
    live.hpCurrent = 5;
    live.conditions.push('prone');
    const restored = undo()!.state;
    expect(restored.hpCurrent).toBe(40);
    expect(restored.conditions).toEqual([]);
  });

  test('canUndo and lastLabel track the stack', () => {
    expect(get(canUndo)).toBe(false);
    expect(get(lastLabel)).toBeNull();
    snapshot(stateWithHp(40), 'Short rest');
    expect(get(canUndo)).toBe(true);
    expect(get(lastLabel)).toBe('Short rest');
    undo();
    expect(get(canUndo)).toBe(false);
  });
});
