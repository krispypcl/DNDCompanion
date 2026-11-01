/** The tick column and row order, which every list on the sheet now shares. */
import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import EntryTable from '$lib/components/EntryTable.svelte';

const columns = [
  { key: 'name', label: 'Name', width: '70%', placeholder: 'Shield' },
  { key: 'level', label: 'Level', width: '30%', options: ['', 'Cantrip', '1', '2'] }
];

const items = [
  { name: 'Shield', level: '1', prepared: true },
  { name: 'Mage Hand', level: 'Cantrip' },
  { name: 'Fireball', level: '2' }
];

const mount = (editable: boolean, onchange = () => {}) =>
  render(EntryTable, {
    props: {
      items,
      columns,
      check: { key: 'prepared', label: 'Prepared' },
      editable,
      category: 'spells' as const,
      emptyText: 'No spells yet.',
      addLabel: 'Add spell',
      blank: () => ({ name: '' }),
      onchange
    }
  });

const rowNames = () =>
  [...document.querySelectorAll('tbody tr .name')].map((c) =>
    (c.querySelector('input')?.value ?? c.textContent ?? '').trim()
  );

describe('EntryTable', () => {
  it('marks the checked rows and leaves the rest blank', () => {
    mount(false);
    // An unticked row says nothing: a dot there read as a mark of its own.
    const ticks = [...document.querySelectorAll('td.tick')].map((c) => c.textContent?.trim());
    expect(ticks).toEqual(['✓', '', '']);
    expect(document.querySelectorAll('td.tick input').length).toBe(0);
  });

  it('puts the drag handle first, then the tick, ahead of the name', () => {
    mount(true);
    const [grip, tick] = [...document.querySelector('tbody tr')!.children];
    expect(grip.className).toContain('gripcell');
    const first = tick;
    expect(first.className).toContain('tick');
    expect(first.getAttribute('data-label')).toBe('Prepared');
  });

  it('reports a box being ticked without disturbing the rest', () => {
    const onchange = vi.fn();
    mount(true, onchange);
    (screen.getByLabelText('Mage Hand prepared') as HTMLInputElement).click();
    const next = onchange.mock.calls.at(-1)![0];
    expect(next[1]).toEqual({ name: 'Mage Hand', level: 'Cantrip', prepared: true });
    expect(next[0]).toEqual(items[0]);
    expect(next.length).toBe(3);
  });

  it('moves a row one place with the arrow keys on its handle', async () => {
    const onchange = vi.fn();
    mount(true, onchange);
    expect(rowNames()).toEqual(['Shield', 'Mage Hand', 'Fireball']);
    await fireEvent.keyDown(screen.getByLabelText(/Reorder Fireball/), { key: 'ArrowUp' });
    expect(onchange.mock.calls.at(-1)![0].map((i: { name: string }) => i.name)).toEqual([
      'Shield',
      'Fireball',
      'Mage Hand'
    ]);
  });

  it('does nothing past either end', async () => {
    const onchange = vi.fn();
    mount(true, onchange);
    await fireEvent.keyDown(screen.getByLabelText(/Reorder Shield/), { key: 'ArrowUp' });
    await fireEvent.keyDown(screen.getByLabelText(/Reorder Fireball/), { key: 'ArrowDown' });
    expect(onchange).not.toHaveBeenCalled();
  });

  it('gives a reader no order controls at all', () => {
    mount(false);
    expect(screen.queryByLabelText(/Reorder/)).toBeNull();
    expect(document.querySelectorAll('td.rm').length).toBe(0);
  });
});
