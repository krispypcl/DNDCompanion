import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import DiceRoller from '$lib/components/DiceRoller.svelte';

describe('DiceRoller', () => {
  it('builds a pool from the dice buttons and the modifier', async () => {
    render(DiceRoller);
    expect((screen.getByRole('button', { name: 'Roll' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: 'Add a d6' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Add a d6' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Add a d20' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Raise the modifier' }));
    await fireEvent.click(screen.getByRole('radio', { name: /^Adv\.$/ }));
    expect(document.querySelector('.formula')!.textContent).toMatch('1d20 + 2d6 + 1, advantage');
    await fireEvent.click(screen.getByRole('button', { name: 'Remove a d6' }));
    expect(document.querySelector('.formula')!.textContent).toMatch('1d20 + 1d6 + 1');
  });

  it('rolls, showing each die and a total in range', async () => {
    render(DiceRoller);
    await fireEvent.click(screen.getByRole('button', { name: 'Add a d4' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await new Promise((r) => setTimeout(r, 500));
    const total = Number(document.querySelector('.total')!.textContent);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(4);
    expect(document.querySelectorAll('.face')).toHaveLength(1);
  });

  it('keeps earlier rolls below', async () => {
    render(DiceRoller);
    await fireEvent.click(screen.getByRole('button', { name: 'Add a d8' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Roll' }));
    expect(screen.getByRole('list', { name: 'Earlier rolls' }).children).toHaveLength(1);
  });
});

import { requestRoll } from '$lib/stores/dice';
import EntryTable from '$lib/components/EntryTable.svelte';
import { parseRoll } from '$lib/rules/dice';
import { vi } from 'vitest';

describe('rolling from the attacks table', () => {
  const columns = [
    { key: 'name', label: 'Name', width: '50%' },
    { key: 'bonus', label: 'Hit', width: '25%', canPress: (v: unknown) => parseRoll(v, 'hit') !== null, pressVerb: 'Roll' },
    { key: 'damage', label: 'Damage', width: '25%', canPress: (v: unknown) => parseRoll(v, 'damage') !== null, pressVerb: 'Roll' }
  ];
  const base = { columns, editable: false, blank: () => ({ name: '' }), onchange: () => {}, category: 'items' as const, emptyText: '', addLabel: 'Add' };

  it('makes hit and damage pressable when they are rolls, and has no 5e.tools link', async () => {
    const onpress = vi.fn();
    render(EntryTable, { props: { ...base, items: [{ name: 'Dagger', bonus: '+7', damage: '1d4+3', source: 'xphb' }, { name: 'Odd', bonus: 'varies', damage: '—' }], links: false, onpress } });
    expect(document.querySelector('a.lookup')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /roll dagger hit \+7/i }));
    expect(onpress).toHaveBeenCalledWith('bonus', expect.objectContaining({ name: 'Dagger' }));
    expect(screen.queryByRole('button', { name: /roll odd/i })).toBeNull();
  });

  it('has nothing to press for someone who cannot roll', () => {
    render(EntryTable, { props: { ...base, items: [{ name: 'Dagger', bonus: '+7', damage: '1d4+3' }] } });
    expect(screen.queryByRole('button', { name: /roll/i })).toBeNull();
  });

  it('opens the tray and rolls what was asked for', async () => {
    const { container } = render(DiceRoller);
    requestRoll(parseRoll('1d4+3', 'damage')!, 'Dagger damage');
    await new Promise((r) => setTimeout(r, 500));
    expect((container.querySelector('details') as HTMLDetailsElement).open).toBe(true);
    expect(container.querySelector('.said')!.textContent).toMatch(/Dagger damage · 1d4 \+ 3/);
    const total = Number(container.querySelector('.total')!.textContent);
    expect(total).toBeGreaterThanOrEqual(4);
    expect(total).toBeLessThanOrEqual(7);
  });
});
