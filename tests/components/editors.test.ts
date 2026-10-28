/**
 * Render tests for the list editors. The tracker crash in phase 1a got through
 * unit tests, type-check and build because nothing rendered the component, so
 * every editor gets mounted here.
 */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import ListEditor from '$lib/components/ListEditor.svelte';

const columns = [
  { key: 'label', label: 'Label' },
  { key: 'type', label: 'Shape', type: 'select' as const, options: ['pips', 'counter'] }
];

describe('ListEditor', () => {
  it('renders a row per item with labelled controls', () => {
    render(ListEditor, {
      props: {
        title: 'Trackers',
        items: [{ label: 'Risk Dice', type: 'pips' }],
        columns,
        blank: () => ({ label: '', type: 'pips' }),
        onchange: () => {}
      }
    });
    expect((screen.getByLabelText('Trackers 1 Label') as HTMLInputElement).value).toBe('Risk Dice');
    expect((screen.getByLabelText('Trackers 1 Shape') as HTMLSelectElement).value).toBe('pips');
  });

  it('adds a blank row', async () => {
    const onchange = vi.fn();
    const blank = () => ({ label: 'New', type: 'pips' });
    render(ListEditor, {
      props: { title: 'Spells', items: [{ label: 'Shield', type: 'pips' }], columns, blank, onchange }
    });
    (screen.getByText('Add') as HTMLButtonElement).click();
    expect(onchange).toHaveBeenCalledWith([{ label: 'Shield', type: 'pips' }, { label: 'New', type: 'pips' }]);
  });

  it('removes the row that was pressed, not the last one', () => {
    const onchange = vi.fn();
    render(ListEditor, {
      props: {
        title: 'Features',
        items: [{ label: 'a', type: 'pips' }, { label: 'b', type: 'pips' }, { label: 'c', type: 'pips' }],
        columns,
        blank: () => ({ label: '', type: 'pips' }),
        onchange
      }
    });
    (screen.getByLabelText('Remove Features 2') as HTMLButtonElement).click();
    expect(onchange).toHaveBeenCalledWith([{ label: 'a', type: 'pips' }, { label: 'c', type: 'pips' }]);
  });

  it('renders an empty list without an add row', () => {
    render(ListEditor, {
      props: {
        title: 'Trackers',
        items: [],
        columns,
        blank: () => ({ label: '', type: 'pips' }),
        onchange: () => {}
      }
    });
    expect(screen.queryByLabelText('Trackers 1 Label')).toBeNull();
    expect(screen.getByText('Add')).toBeTruthy();
  });
});
