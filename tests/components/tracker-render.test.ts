/**
 * Render tests for every tracker shape. A gauge used to render a bar and
 * nothing else, so it could never be changed — the bar was decoration.
 */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import Tracker from '$lib/components/Tracker.svelte';
import type { FormulaContext } from '$lib/rules/formula';
import type { Tracker as TrackerDef } from '$lib/types';

const ctx: FormulaContext = { level: 5, prof: 3, str: 0, dex: 4, con: 2, int: 0, wis: 1, cha: 4 };

const def = (over: Partial<TrackerDef> = {}): TrackerDef => ({
  id: 't1',
  label: 'Risk Dice',
  max: 4,
  type: 'pips',
  direction: 'spend',
  reset: { on: 'short', amount: 'full' },
  ...over
});

function mount(tracker: TrackerDef, spent = 0, editable = true) {
  const onchange = vi.fn();
  render(Tracker, { props: { tracker, spent, ctx, editable, onchange } });
  return onchange;
}

describe('Tracker', () => {
  describe.each(['pips', 'gauge'] as const)('%s', (type) => {
    it('gives the owner a way to lower the value', async () => {
      const onchange = mount(def({ type }), 1);
      // 1 spent of 4, so 3 remain: tapping the third pip leaves 2.
      const lower =
        type === 'pips'
          ? screen.getByLabelText('Risk Dice 3')
          : screen.getByLabelText('Decrease');
      (lower as HTMLButtonElement).click();
      expect(onchange).toHaveBeenCalled();
      expect(onchange.mock.calls.at(-1)![0]).toBeTypeOf('number');
    });

    it('shows the remaining count as text', () => {
      mount(def({ type }), 1);
      expect(screen.queryAllByText('3').length).toBeGreaterThan(0);
    });

    it('offers no controls to a viewer', () => {
      mount(def({ type }), 1, false);
      for (const b of screen.queryAllByRole('button')) {
        expect((b as HTMLButtonElement).disabled, 'viewer controls must be disabled').toBe(true);
      }
    });
  });

  /**
   * The buttons move what the reader sees — the remaining count. On a spend
   * tracker that is the inverse of the stored spent count, and the stepper
   * used to move the stored number directly, so "Decrease" raised the
   * displayed value.
   */
  it('lowers the remaining count on a spend tracker', () => {
    const onchange = mount(def({ type: 'gauge', max: 4 }), 1); // 3 of 4 left
    (screen.getByLabelText('Decrease') as HTMLButtonElement).click();
    expect(onchange).toHaveBeenLastCalledWith(2); // 2 spent, so 2 left
  });

  it('lowers the remaining count on an accrue tracker', () => {
    const onchange = mount(def({ type: 'gauge', max: 4, direction: 'accrue' }), 3);
    (screen.getByLabelText('Decrease') as HTMLButtonElement).click();
    expect(onchange).toHaveBeenLastCalledWith(2);
  });

  it('clamps a gauge at both ends', () => {
    const full = mount(def({ type: 'gauge', max: 3 }), 0); // nothing spent: 3 of 3
    (screen.getByLabelText('Increase') as HTMLButtonElement).click();
    expect(full).toHaveBeenLastCalledWith(0); // already full

    const spentAll = mount(def({ type: 'gauge', max: 3 }), 3); // 0 of 3
    (screen.getAllByLabelText('Decrease').at(-1) as HTMLButtonElement).click();
    expect(spentAll).toHaveBeenLastCalledWith(3); // already empty
  });

  it('lowers a gauge, which previously had no controls at all', () => {
    const onchange = mount(def({ type: 'gauge', max: 3 }), 0);
    (screen.getByLabelText('Decrease') as HTMLButtonElement).click();
    expect(onchange).toHaveBeenLastCalledWith(1);
  });

  describe('pips show what is left', () => {
    it('fills from the left and empties from the right', () => {
      mount(def({ max: 4 }), 1); // 3 of 4 remain
      const on = [1, 2, 3, 4].map((n) =>
        (screen.getByLabelText(`Risk Dice ${n}`) as HTMLButtonElement)
          .getAttribute('aria-pressed')
      );
      expect(on).toEqual(['true', 'true', 'true', 'false']);
    });

    it('fills from the left for an accrue tracker too', () => {
      mount(def({ max: 4, direction: 'accrue' }), 2);
      const on = [1, 2, 3, 4].map((n) =>
        (screen.getByLabelText(`Risk Dice ${n}`) as HTMLButtonElement)
          .getAttribute('aria-pressed')
      );
      expect(on).toEqual(['true', 'true', 'false', 'false']);
    });

    it('leaves n remaining when pip n is tapped', () => {
      const onchange = mount(def({ max: 4 }), 0); // full
      (screen.getByLabelText('Risk Dice 2') as HTMLButtonElement).click();
      expect(onchange).toHaveBeenLastCalledWith(2); // 2 spent, 2 left
    });

    it('empties on a second tap of the last lit pip', () => {
      const onchange = mount(def({ max: 4 }), 3); // 1 left
      (screen.getByLabelText('Risk Dice 1') as HTMLButtonElement).click();
      expect(onchange).toHaveBeenLastCalledWith(4); // all spent
    });

    it('restores by tapping a pip beyond what is lit', () => {
      const onchange = mount(def({ max: 4 }), 3); // 1 left
      (screen.getByLabelText('Risk Dice 4') as HTMLButtonElement).click();
      expect(onchange).toHaveBeenLastCalledWith(0); // back to full
    });
  });

  it('reports a bad formula instead of rendering controls', () => {
    mount(def({ type: 'gauge', max: 'prof + ' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Formula error/);
    expect(screen.queryByLabelText('Increase')).toBeNull();
  });
});
