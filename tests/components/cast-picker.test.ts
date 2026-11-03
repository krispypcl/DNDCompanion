import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import CastPicker from '$lib/components/CastPicker.svelte';

const fireball = { name: 'Fireball', level: '3', save: 'DEX', damage: '8d6 +1d6/level' } as never;
const bolt = { name: 'Guiding Bolt', level: '1', damage: '4d6 +1d6/level' } as never;

describe('the cast dialog', () => {
  it('picks the lowest slot with one left, shows each level’s roll, and spends one with the damage', async () => {
    const onroll = vi.fn();
    const oncancel = vi.fn();
    const slots = new Map([[3, { max: 2, left: 0 }], [4, { max: 1, left: 1 }], [5, { max: 0, left: 0 }]]);
    render(CastPicker, { props: { spell: fireball, slots, attack: 7, saveDc: 15, onroll, oncancel } });
    expect(screen.getByRole('radio', { checked: true }).textContent).toMatch(/4th.*9d6.*1 of 1 left/);
    expect(screen.queryByText('5th')).toBeNull();
    expect(screen.getByText('DEX save, DC 15')).toBeTruthy();
    // A save spell has no attack roll.
    expect(screen.queryByRole('button', { name: /attack/i })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /roll 9d6/i }));
    expect(onroll).toHaveBeenCalledWith('damage', 4, true);
    expect(oncancel).toHaveBeenCalled();
  });

  it('rolls the attack first and spends the slot only once', async () => {
    const onroll = vi.fn();
    const slots = new Map([[1, { max: 2, left: 2 }]]);
    render(CastPicker, { props: { spell: bolt, slots, attack: 5, onroll, oncancel: () => {} } });
    await fireEvent.click(screen.getByRole('button', { name: /attack \+5/i }));
    expect(onroll).toHaveBeenLastCalledWith('attack', 1, true);
    expect(screen.getByText('Slot spent')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: /roll 4d6/i }));
    expect(onroll).toHaveBeenLastCalledWith('damage', 1, false);
  });

  it('casts a cantrip with no slot, its dice grown with the character', async () => {
    const onroll = vi.fn();
    render(CastPicker, { props: { spell: { name: 'Fire Bolt', level: 'Cantrip', damage: '1d10' } as never, slots: new Map(), attack: 7, characterLevel: 5, onroll, oncancel: () => {} } });
    expect(screen.queryByRole('radiogroup')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /roll 2d10/i }));
    expect(onroll).toHaveBeenCalledWith('damage', null, false);
  });

  it('closes on Escape', async () => {
    const oncancel = vi.fn();
    render(CastPicker, { props: { spell: fireball, slots: new Map(), onroll: () => {}, oncancel } });
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(oncancel).toHaveBeenCalled();
  });
});
