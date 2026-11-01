/** Spells sit in level order with headings; a row still moves by hand, within its group. */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import EntryTable from '$lib/components/EntryTable.svelte';
import { spellGroupTitle, spellRank } from '$lib/rules/spells';

const columns = [
  { key: 'name', label: 'Name', width: '60%' },
  { key: 'level', label: 'Level', width: '20%' },
  { key: 'notes', label: 'Notes', width: '20%', wide: true }
];
const groupBy = { key: 'level', rank: (s: Record<string, unknown>) => spellRank(s.level), title: spellGroupTitle };

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

  it('moves a row within its group by swapping the two entries in the data', async () => {
    const onchange = mount(true);
    await fireEvent.click(screen.getByLabelText('Move Magic Missile up'));
    const next = onchange.mock.calls[0][0] as typeof spells;
    expect(next.map((s) => s.name)).toEqual(['Fireball', 'Magic Missile', 'Light', 'Shield', 'Mystery']);
  });

  it('will not move a row across a group', () => {
    mount(true);
    // Shield is first in 1st level; the row above it on screen is a cantrip.
    expect((screen.getByLabelText('Move Shield up') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Move Magic Missile down') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Move Shield down') as HTMLButtonElement).disabled).toBe(false);
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
