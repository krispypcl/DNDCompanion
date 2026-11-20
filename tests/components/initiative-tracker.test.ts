import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import InitiativeTracker from '#lib/components/InitiativeTracker.svelte';
import type { InitiativeRow } from '#lib/rules/initiative.ts';

const party: InitiativeRow[] = [
  { key: 'pc:a', name: 'Bramble', value: null, side: 'pc', dex: 2 },
  { key: 'pc:b', name: 'Loka', value: 14, side: 'pc', dex: 3 },
  { key: 'cr:g', name: 'Goblin', value: null, side: 'creature', dex: 2 }
];
const buttons = (c: HTMLElement) => [...c.querySelectorAll('.secend button')].map((b) => b.textContent?.trim());

describe('InitiativeTracker', () => {
  it('folds away while no one calls for it, leaving the DM only Call for initiative', () => {
    const { container } = render(InitiativeTracker, { props: { combatants: party, turn: null, round: 0, isDm: true } });
    expect(container.querySelector('#init-fold')?.classList.contains('folded')).toBe(true);
    expect(buttons(container)).toEqual(['Call for initiative']);
  });

  it('opens while calling, says who it waits on beside the buttons, and can be cancelled', async () => {
    const oncancel = vi.fn();
    const { container } = render(InitiativeTracker, {
      props: { combatants: party, turn: null, round: 0, asking: true, isDm: true, oncancel, onrollrest: () => {} }
    });
    expect(container.querySelector('#init-fold')?.classList.contains('folded')).toBe(false);
    expect(container.querySelector('.secend .initcall')?.textContent).toBe('Waiting on 1 character.');
    expect(buttons(container)).toEqual(['Cancel', 'Roll the rest', 'Start']);
    await fireEvent.click(container.querySelector('.secend button')!);
    expect(oncancel).toHaveBeenCalledOnce();
  });

  it('can be opened by hand between fights', async () => {
    const { container } = render(InitiativeTracker, { props: { combatants: party, turn: null, round: 0, isDm: true, onrollrest: () => {} } });
    await fireEvent.click(container.querySelector('.secfold')!);
    expect(container.querySelector('#init-fold')?.classList.contains('folded')).toBe(false);
    expect(buttons(container)).toEqual(['Call for initiative', 'Roll the rest', 'Start']);
  });

  it('tells a player to roll, with nothing folded', () => {
    const mine = party.map((c) => (c.key === 'pc:a' ? { ...c, mine: true } : c));
    const { container } = render(InitiativeTracker, { props: { combatants: mine, turn: null, round: 0, asking: true, isDm: false } });
    expect(container.querySelector('.secfold')).toBeNull();
    expect(container.querySelector('.initcall')?.textContent).toBe('Roll for initiative!');
  });
});
