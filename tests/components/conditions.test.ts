/** The owner moves conditions from the sheet itself; a viewer only reads them. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Conditions from '$lib/components/Conditions.svelte';
import { canUndo, resetUndo } from '$lib/stores/undo';
import { get } from 'svelte/store';
import { emptyState } from '$lib/types';

describe('Conditions', () => {
  beforeEach(() => resetUndo());

  it('shows a viewer nothing when nothing is active', () => {
    const { container } = render(Conditions, { props: { state: emptyState(), editable: false, onchange: vi.fn() } });
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows a viewer the chips, without a way to remove them', () => {
    render(Conditions, {
      props: { state: { ...emptyState(), conditions: ['Prone', 'Bless'] }, editable: false, onchange: vi.fn() }
    });
    expect(screen.getByText('Prone')).toBeTruthy();
    expect(screen.getByText('Bless')).toBeTruthy();
    expect(screen.queryByLabelText('Remove Prone')).toBeNull();
    expect(screen.queryByLabelText('Add a condition or effect')).toBeNull();
  });

  it('lets the owner add one with Enter, and can be undone', async () => {
    const onchange = vi.fn();
    render(Conditions, { props: { state: emptyState(), editable: true, onchange } });
    const box = screen.getByLabelText('Add a condition or effect');
    await fireEvent.input(box, { target: { value: 'Stunned' } });
    await fireEvent.keyDown(box, { key: 'Enter' });
    expect(onchange).toHaveBeenCalledTimes(1);
    expect(onchange.mock.calls[0][0].conditions).toEqual(['Stunned']);
    expect(get(canUndo)).toBe(true);
  });

  it('does nothing for a blank entry', async () => {
    const onchange = vi.fn();
    render(Conditions, { props: { state: emptyState(), editable: true, onchange } });
    await fireEvent.keyDown(screen.getByLabelText('Add a condition or effect'), { key: 'Enter' });
    expect(onchange).not.toHaveBeenCalled();
    expect(get(canUndo)).toBe(false);
  });

  it('lets the owner remove one', async () => {
    const onchange = vi.fn();
    render(Conditions, {
      props: { state: { ...emptyState(), conditions: ['Prone', 'Bless'] }, editable: true, onchange }
    });
    await fireEvent.click(screen.getByLabelText('Remove Prone'));
    expect(onchange.mock.calls[0][0].conditions).toEqual(['Bless']);
  });
});
