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
    await fireEvent.click(screen.getByRole('radio', { name: 'Adv.', exact: true }));
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
