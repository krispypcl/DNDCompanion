import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import AttackList from '$lib/components/AttackList.svelte';
import EntryLink from '$lib/components/EntryLink.svelte';
import EquipmentList from '$lib/components/EquipmentList.svelte';
import RestButtons from '$lib/components/RestButtons.svelte';
import SaveIndicator from '$lib/components/SaveIndicator.svelte';
import SpellTable from '$lib/components/SpellTable.svelte';
import TrackerGroup from '$lib/components/TrackerGroup.svelte';
import UndoToast from '$lib/components/UndoToast.svelte';
import { formulaContext } from '$lib/rules/derived';
import { blankDefinition } from '$lib/sample';
import { emptyState, type Definition, type Tracker } from '$lib/types';

const def: Definition = {
  ...blankDefinition('Smoke'),
  attacks: [{ name: 'Revolver', bonus: '+10', damage: '2d6+1', source: 'valdagunslinger' }],
  spells: [{ name: 'Shield', time: 'Rxn', source: 'xphb' }],
  equipment: [{ name: "Sheriff's Star", qty: 1, source: 'homebrew' }],
  currency: { gp: 11, sp: 6 }
};

const slots: Tracker[] = [
  { id: '1', label: '1st', max: 4, type: 'pips', direction: 'spend', reset: { on: 'long', amount: 'full' }, group: 'Spell Slots' },
  { id: '2', label: '2nd', max: 3, type: 'pips', direction: 'spend', reset: { on: 'long', amount: 'full' }, group: 'Spell Slots' },
  { id: 'ex', label: 'Exhaustion', max: 6, type: 'counter', direction: 'accrue', reset: { on: 'long', amount: 1 } },
  { id: 'g', label: 'Grit', max: 'cha', type: 'gauge', direction: 'spend', reset: { on: 'short', amount: 'full' } }
];

describe('every component renders without throwing', () => {
  test.each([true, false])('AttackList (editable: %s)', (editable) => {
    const { container } = render(AttackList, { props: { definition: def, editable, onchange: () => {} } });
    // In edit mode the name sits in an input's value, not in textContent.
    const shown = editable
      ? [...container.querySelectorAll('input')].map((i) => i.value).join(' ')
      : (container.textContent ?? '');
    expect(shown).toContain('Revolver');
  });

  test.each([true, false])('EquipmentList (editable: %s)', (editable) => {
    const { container } = render(EquipmentList, { props: { definition: def, editable, onchange: () => {} } });
    const shown = editable
      ? [...container.querySelectorAll('input')].map((i) => i.value).join(' ')
      : (container.textContent ?? '');
    expect(shown).toContain("Sheriff's Star");
  });

  test('SpellTable', () => {
    const { container } = render(SpellTable, { props: { definition: def } });
    expect(container.textContent).toContain('Shield');
  });

  test('TrackerGroup renders groups, counters and gauges together', () => {
    const { container } = render(TrackerGroup, {
      props: {
        trackers: slots,
        spent: { '1': 1, ex: 2 },
        ctx: formulaContext(def),
        editable: true,
        onchange: () => {}
      }
    });
    expect(container.textContent).toContain('Spell Slots');
    expect(container.textContent).toContain('Exhaustion');
    expect(container.textContent).toContain('Grit');
  });

  test('RestButtons offers all three rests', () => {
    const { container } = render(RestButtons, {
      props: {
        definition: def,
        state: emptyState(),
        editable: true,
        onchange: () => {},
        onrest: () => {}
      }
    });
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(labels).toEqual(['Short rest', 'Long rest', 'Dawn']);
  });

  test('EntryLink builds a real link for a sourced entry', () => {
    const { container } = render(EntryLink, {
      props: { name: 'Shield', source: 'xphb', category: 'spells' }
    });
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      'https://5e.tools/spells.html#shield_xphb'
    );
  });

  test('EntryLink tags homebrew instead of linking', () => {
    const { container } = render(EntryLink, {
      props: { name: "Sheriff's Star", source: 'homebrew', category: 'items' }
    });
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('Homebrew');
  });

  test('UndoToast shows its label', () => {
    const { container } = render(UndoToast, {
      props: { label: 'Long rest taken', onundo: () => {}, onexpire: () => {} }
    });
    expect(container.textContent).toContain('Long rest taken');
    expect(container.textContent).toContain('Undo');
  });

  test('SaveIndicator renders nothing while idle', () => {
    const { container } = render(SaveIndicator);
    expect(container.textContent?.trim()).toBe('');
  });
});
