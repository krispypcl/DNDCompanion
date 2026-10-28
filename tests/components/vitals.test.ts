/** VitalsStrip in edit mode: the written combat numbers become editable. */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import VitalsStrip from '$lib/components/VitalsStrip.svelte';
import { emptyState, type Definition } from '$lib/types';

const definition = (): Definition => ({
  identity: { name: 'Loka', level: 5 },
  abilities: { str: 10, dex: 18, con: 14, int: 10, wis: 12, cha: 18 },
  proficiency: 3,
  combat: { ac: 17, speed: 30, hpMax: 44, hitDice: '5d10' },
  saves: {},
  skills: {},
  attacks: [],
  features: [],
  spells: [],
  trackers: [],
  equipment: [],
  currency: {},
  notes: ''
});

const state = () => ({ ...emptyState(), hpCurrent: 44 });

describe('VitalsStrip', () => {
  it('shows combat numbers read-only by default', () => {
    render(VitalsStrip, {
      props: { definition: definition(), state: state(), editable: false, onchange: () => {} }
    });
    expect(screen.getByText('17')).toBeTruthy();
    expect(screen.getByText('5d10')).toBeTruthy();
    expect(screen.queryByLabelText('Max HP')).toBeNull();
  });

  it('renders without crashing in edit mode and exposes every combat field', () => {
    render(VitalsStrip, {
      props: {
        definition: definition(),
        state: state(),
        editable: true,
        editDefinition: true,
        onchange: () => {},
        ondefinition: () => {}
      }
    });
    for (const label of ['Max HP', 'AC', 'Speed', 'Hit dice']) {
      expect(screen.getByLabelText(label), `${label} should be editable`).toBeTruthy();
    }
  });

  it('reports a max HP change without disturbing the rest of the definition', async () => {
    const ondefinition = vi.fn();
    render(VitalsStrip, {
      props: {
        definition: definition(),
        state: state(),
        editable: true,
        editDefinition: true,
        onchange: () => {},
        ondefinition
      }
    });
    const field = screen.getByLabelText('Max HP') as HTMLInputElement;
    field.value = '52';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    expect(ondefinition).toHaveBeenCalled();
    const next = ondefinition.mock.calls.at(-1)![0] as Definition;
    expect(next.combat).toEqual({ ac: 17, speed: 30, hpMax: 52, hitDice: '5d10' });
    expect(next.identity.name).toBe('Loka');
  });
});
