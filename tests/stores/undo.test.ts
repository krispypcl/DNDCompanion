import { beforeEach, describe, expect, test } from 'vitest';
import { resetUndo, snapshot, undo } from '#lib/stores/undo.ts';
import { emptyState, type State } from '#lib/types.ts';

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

  test('undo hands back the last action by its label, then nothing', () => {
    expect(undo()).toBeNull();
    snapshot(stateWithHp(40), 'Short rest');
    expect(undo()?.label).toBe('Short rest');
    expect(undo()).toBeNull();
  });
});
