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

  /** jsdom has no layout: give each row a 40px slot down the page. */
  const layOut = () =>
    ([...document.querySelectorAll('tbody tr:not(.group)')] as HTMLElement[]).forEach((row, i) => {
      row.getBoundingClientRect = () =>
        ({ top: i * 40, height: 40, bottom: i * 40 + 40, left: 0, right: 0, width: 0, x: 0, y: i * 40, toJSON() {} }) as DOMRect;
    });

  async function drag(name: string, fromY: number, toY: number) {
    const grip = screen.getByLabelText(new RegExp(`reorder ${name}`, 'i'));
    await fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientY: fromY });
    await fireEvent.pointerMove(grip, { pointerId: 1, clientY: toY });
    await fireEvent.pointerUp(grip, { pointerId: 1, clientY: toY });
  }

  it('moves a row by dragging its handle', async () => {
    const onchange = vi.fn();
    mount(true, onchange);
    layOut();
    expect(rowNames()).toEqual(['Shield', 'Mage Hand', 'Fireball']);
    await drag('Fireball', 100, 50);
    expect(onchange.mock.calls.at(-1)![0].map((i: { name: string }) => i.name)).toEqual([
      'Shield',
      'Fireball',
      'Mage Hand'
    ]);
  });

  it('leaves the order alone when the arrow keys are pressed on the handle, so the page can scroll', async () => {
    const onchange = vi.fn();
    mount(true, onchange);
    await fireEvent.keyDown(screen.getByLabelText(/reorder Fireball/i), { key: 'ArrowUp' });
    expect(onchange).not.toHaveBeenCalled();
  });

  it('gives a reader no order controls at all', () => {
    mount(false);
    expect(screen.queryByLabelText(/Reorder/)).toBeNull();
    expect(document.querySelectorAll('td.rm').length).toBe(0);
  });
});

describe('the source column', () => {
  const columns = [
    { key: 'name', label: 'Name', width: '70%' },
    { key: 'source', label: 'Source', width: '30%' }
  ];
  const props = { columns, items: [{ name: 'Rope', source: 'xphb' }], blank: () => ({ name: '' }), onchange: () => {}, category: 'items' as const, emptyText: '', addLabel: 'Add' };

  it('shows only while editing', () => {
    const view = render(EntryTable, { props: { ...props, editable: false } });
    expect(view.container.querySelectorAll('th').length).toBe(1);
    view.unmount();
    const edit = render(EntryTable, { props: { ...props, editable: true } });
    expect([...edit.container.querySelectorAll('th')].some((th) => /Source/.test(th.textContent ?? ''))).toBe(true);
  });
});
