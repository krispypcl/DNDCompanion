/** Spells sit in type order with headings; a row still moves by hand, within its group. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import EntryTable from '$lib/components/EntryTable.svelte';
import { spellGroup, spellRank } from '$lib/rules/spells';

const columns = [
  { key: 'name', label: 'Name', width: '60%' },
  { key: 'level', label: 'Level', width: '20%' },
  { key: 'notes', label: 'Notes', width: '20%', wide: true }
];
const groupBy = {
  key: 'level',
  rank: (s: Record<string, unknown>) => spellRank(s.level),
  title: (s: Record<string, unknown>) => spellGroup(s.level)
};

const spells = [
  { name: 'Fireball', level: '3' },
  { name: 'Shield', level: '1' },
  { name: 'Light', level: 'Cantrip' },
  { name: 'Magic Missile', level: '1' },
  { name: 'Mystery' }
];

function mount(editable: boolean, onchange = vi.fn(), items = spells) {
  render(EntryTable, {
    props: { items, columns, groupBy, editable, blank: () => ({ name: '' }), onchange, category: 'spells' as const, emptyText: 'none', addLabel: 'Add' }
  });
  return onchange;
}

const order = () =>
  [...document.querySelectorAll('tbody tr')].map((tr) =>
    tr.classList.contains('group') ? `# ${tr.textContent?.trim()}` : tr.querySelector('.nm')?.textContent?.trim() ?? ''
  );

describe('grouped table', () => {
  it('lists by level with cantrips first and a heading for each group', () => {
    mount(false);
    expect(order()).toEqual([
      '# Cantrips', 'Light',
      '# 1st level', 'Shield', 'Magic Missile',
      '# 3rd level', 'Fireball',
      '# No level yet', 'Mystery'
    ]);
  });

  it('keeps the placed order inside a group', () => {
    mount(false, vi.fn(), [
      { name: 'B', level: '1' },
      { name: 'A', level: '1' }
    ]);
    expect(order().filter((r) => !r.startsWith('#'))).toEqual(['B', 'A']);
  });

  it('shows no headings when everything is one level', () => {
    mount(false, vi.fn(), [{ name: 'A', level: '2' }, { name: 'B', level: '2' }]);
    expect(order()).toEqual(['A', 'B']);
  });

  it('does not touch the stored order just by showing it', () => {
    const onchange = mount(false);
    expect(onchange).not.toHaveBeenCalled();
  });

  it('will not drag a row across a group', async () => {
    const onchange = mount(true);
    // Rows on screen: Light | Shield, Magic Missile | Fireball | Mystery.
    const rows = [...document.querySelectorAll('tbody tr:not(.group)')] as HTMLElement[];
    rows.forEach((row, i) => {
      row.getBoundingClientRect = () => ({ top: i * 40, height: 40, bottom: i * 40 + 40, left: 0, right: 0, width: 0, x: 0, y: i * 40, toJSON() {} });
    });
    const grip = screen.getByLabelText(/reorder Shield/i);
    // Dragged far down, past Fireball: it can only go to the end of its own group.
    await fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientY: 60 });
    await fireEvent.pointerMove(grip, { pointerId: 1, clientY: 190 });
    await fireEvent.pointerUp(grip, { pointerId: 1, clientY: 190 });
    const next = onchange.mock.calls[0][0] as typeof spells;
    expect(next.map((s) => s.name)).toEqual(['Fireball', 'Magic Missile', 'Light', 'Shield', 'Mystery']);
    // A row alone in its group has nothing to trade places with.
    expect((screen.getByLabelText(/reorder Light/i) as HTMLButtonElement).disabled).toBe(true);
  });

  it('moves a row by dragging its handle past another', async () => {
    const onchange = mount(true, vi.fn(), [
      { name: 'A', level: '1' },
      { name: 'B', level: '1' },
      { name: 'C', level: '1' }
    ]);
    // jsdom has no layout: give each row a 40px slot down the page.
    const rows = [...document.querySelectorAll('tbody tr:not(.group)')] as HTMLElement[];
    rows.forEach((row, i) => {
      row.getBoundingClientRect = () => ({ top: i * 40, height: 40, bottom: i * 40 + 40, left: 0, right: 0, width: 0, x: 0, y: i * 40, toJSON() {} });
    });
    const grip = screen.getByLabelText(/reorder A/i);
    await fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientY: 20 });
    await fireEvent.pointerMove(grip, { pointerId: 1, clientY: 125 });
    await fireEvent.pointerUp(grip, { pointerId: 1, clientY: 125 });
    expect((onchange.mock.calls[0][0] as { name: string }[]).map((s) => s.name)).toEqual(['B', 'C', 'A']);
  });

  it('puts a dropped row back where it was if it did not travel', async () => {
    const onchange = mount(true, vi.fn(), [{ name: 'A', level: '1' }, { name: 'B', level: '1' }]);
    const grip = screen.getByLabelText(/reorder A/i);
    await fireEvent.pointerDown(grip, { button: 0, pointerId: 1, clientY: 0 });
    await fireEvent.pointerUp(grip, { pointerId: 1, clientY: 0 });
    expect(onchange).not.toHaveBeenCalled();
  });

  it('groups the player’s own types after the levels', () => {
    mount(false, vi.fn(), [{ name: 'X', level: 'Ritual' }, { name: 'Y', level: '2' }, { name: 'Z', level: 'ritual' }]);
    expect(order()).toEqual(['# 2nd level', 'Y', '# Ritual', 'X', 'Z']);
  });

  it('removes the row that was meant, not the one at that screen position', async () => {
    const onchange = mount(true);
    await fireEvent.click(screen.getByLabelText('Remove Light'));
    expect((onchange.mock.calls[0][0] as typeof spells).map((s) => s.name)).toEqual([
      'Fireball', 'Shield', 'Magic Missile', 'Mystery'
    ]);
  });

  it('marks blank cells so a card can leave them out', () => {
    mount(false);
    const mystery = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent?.includes('Mystery'))!;
    expect(mystery.querySelector('td[data-label="Notes"]')?.hasAttribute('data-empty')).toBe(true);
    expect(mystery.querySelector('td[data-label="Level"]')?.hasAttribute('data-empty')).toBe(true);
  });
});
