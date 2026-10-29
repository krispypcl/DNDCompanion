/** The tick column and row order, which every list on the sheet now shares. */
import { render, screen } from '@testing-library/svelte';
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
  it('marks the checked rows for a reader without offering a control', () => {
    mount(false);
    const ticks = [...document.querySelectorAll('td.tick')].map((c) => c.textContent?.trim());
    expect(ticks).toEqual(['✓', '·', '·']);
    expect(document.querySelectorAll('td.tick input').length).toBe(0);
  });

  it('puts the tick ahead of the name', () => {
    mount(true);
    const first = document.querySelector('tbody tr')!.firstElementChild!;
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

  it('moves a row by swapping it with its neighbour', () => {
    const onchange = vi.fn();
    mount(true, onchange);
    expect(rowNames()).toEqual(['Shield', 'Mage Hand', 'Fireball']);
    (screen.getByLabelText(/Move Fireball up$/) as HTMLButtonElement).click();
    expect(onchange.mock.calls.at(-1)![0].map((i: { name: string }) => i.name)).toEqual([
      'Shield',
      'Fireball',
      'Mage Hand'
    ]);

    (screen.getByLabelText(/Move Shield down$/) as HTMLButtonElement).click();
    expect(onchange.mock.calls.at(-1)![0].map((i: { name: string }) => i.name)).toEqual([
      'Mage Hand',
      'Shield',
      'Fireball'
    ]);
  });

  it('cannot move the first row up or the last row down', () => {
    mount(true);
    expect((screen.getByLabelText(/Move Shield up$/) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText(/Move Shield down$/) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByLabelText(/Move Fireball down$/) as HTMLButtonElement).disabled).toBe(true);
  });

  it('gives a reader no order controls at all', () => {
    mount(false);
    expect(screen.queryByLabelText(/Move/)).toBeNull();
    expect(document.querySelectorAll('td.rm').length).toBe(0);
  });
});
