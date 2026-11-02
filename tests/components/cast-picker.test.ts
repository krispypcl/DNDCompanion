import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import CastPicker from '$lib/components/CastPicker.svelte';

const spell = { name: 'Fireball', level: '3', damage: '8d6 +1d6/level' } as never;

describe('CastPicker', () => {
  it('lists only levels with slots, and spends one by default', async () => {
    const oncast = vi.fn();
    const slots = new Map([[3, { max: 2, left: 1 }], [4, { max: 1, left: 0 }], [5, { max: 0, left: 0 }]]);
    render(CastPicker, { props: { spell, slots, oncast, oncancel: () => {} } });
    expect(screen.getByText('1 of 2 left')).toBeTruthy();
    expect(screen.queryByText('5th')).toBeNull();
    await fireEvent.click(screen.getByText('3rd'));
    expect(oncast).toHaveBeenCalledWith(3, true);
  });

  it('does not spend when told not to, or when none are left', async () => {
    const oncast = vi.fn();
    const slots = new Map([[3, { max: 2, left: 2 }], [4, { max: 1, left: 0 }]]);
    render(CastPicker, { props: { spell, slots, oncast, oncancel: () => {} } });
    await fireEvent.click(screen.getByText('4th'));
    expect(oncast).toHaveBeenLastCalledWith(4, false);
    await fireEvent.click(screen.getByLabelText('Spend a slot'));
    await fireEvent.click(screen.getByText('3rd'));
    expect(oncast).toHaveBeenLastCalledWith(3, false);
  });

  it('offers every level up to 9th without slot trackers, and cancels on Escape', async () => {
    const oncancel = vi.fn();
    render(CastPicker, { props: { spell, slots: new Map(), oncast: () => {}, oncancel } });
    expect(screen.getAllByRole('button').filter((b) => b.classList.contains('lvl'))).toHaveLength(7);
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(oncancel).toHaveBeenCalled();
  });
});
