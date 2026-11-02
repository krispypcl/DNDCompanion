import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import EntryTable from '$lib/components/EntryTable.svelte';

const items = [
  { name: 'Sword', attuned: true },
  { name: 'Ring', attuned: true },
  { name: 'Rope' },
  { name: 'Cloak' }
];
const props = (limit: number) => ({
  items,
  columns: [{ key: 'name', label: 'Item', width: '100%' }],
  check: { key: 'attuned', label: 'Attuned', limit, full: 'All slots in use!' },
  groupBy: { key: 'attuned', rank: (i: Record<string, unknown>) => (i.attuned ? 0 : 1), title: (i: Record<string, unknown>) => (i.attuned ? 'Attuned' : 'Carried') },
  editable: true,
  blank: () => ({ name: '' }),
  onchange: () => {},
  category: 'items' as const,
  emptyText: '',
  addLabel: 'Add item'
});

describe('attunement', () => {
  it('lists attuned items first', () => {
    const { container } = render(EntryTable, { props: props(3) });
    const names = [...container.querySelectorAll('td.name input')].map((i) => (i as HTMLInputElement).value);
    expect(names.slice(0, 2)).toEqual(['Sword', 'Ring']);
  });

  it('stops a fourth once the slots are full, but lets one be taken off', () => {
    render(EntryTable, { props: props(2) });
    expect((screen.getByLabelText('Rope attuned') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Sword attuned') as HTMLInputElement).disabled).toBe(false);
  });
});
