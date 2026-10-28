/** The hit point module: HP, temp HP, hit dice, death saves, and the written
    maximum becoming editable in edit mode. AC moved to the defense rail. */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import HitPoints from '$lib/components/HitPoints.svelte';
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

describe('HitPoints', () => {
  it('keeps the hit dice on the hit point line rather than in a box of its own', () => {
    const { container } = render(HitPoints, {
      props: { definition: definition(), state: state(), editable: false, onchange: () => {} }
    });
    expect(container.querySelector('.hp-readout .dice')?.textContent).toContain('5d10');
    expect(container.querySelector('.pairs')).toBeNull();
  });

  it('shows the written numbers read-only by default', () => {
    render(HitPoints, {
      props: { definition: definition(), state: state(), editable: false, onchange: () => {} }
    });
    expect(screen.getByText('5d10')).toBeTruthy();
    expect(screen.queryByLabelText('Max HP')).toBeNull();
    expect(screen.queryByLabelText('Hit dice')).toBeNull();
  });

  it('shows no temp HP marker when there is none', () => {
    const { container } = render(HitPoints, {
      props: { definition: definition(), state: state(), editable: true, onchange: () => {} }
    });
    expect(container.querySelector('.temp')).toBeNull();
    expect((container.querySelector('.tmp') as HTMLElement).style.width).toBe('0%');
  });

  it('shows temp HP as a plus beside the total, and as the tail of the bar', () => {
    const { container } = render(HitPoints, {
      props: {
        definition: definition(),          // 44 max
        state: { ...state(), hpTemp: 11 }, // 44 + 11 = 55 total
        editable: true,
        onchange: () => {}
      }
    });
    // The marker carries its own "temp" label for context.
    expect(container.querySelector('.temp')?.textContent?.trim()).toBe('+11temp');
    expect(container.querySelector('.temp small')?.textContent).toBe('temp');
    expect((container.querySelector('.tmp') as HTMLElement).style.width).toBe('20%');
    expect((container.querySelector('.cur') as HTMLElement).style.width).toBe('80%');
  });

  it('offers death saves only once the character is down', () => {
    const { unmount } = render(HitPoints, {
      props: { definition: definition(), state: state(), editable: true, onchange: () => {} }
    });
    expect(screen.queryByLabelText('failures 1')).toBeNull();
    unmount();

    render(HitPoints, {
      props: {
        definition: definition(),
        state: { ...state(), hpCurrent: 0 },
        editable: true,
        onchange: () => {}
      }
    });
    expect(screen.getByLabelText('failures 1')).toBeTruthy();
  });

  it('renders without crashing in edit mode and exposes the written numbers', () => {
    render(HitPoints, {
      props: {
        definition: definition(),
        state: state(),
        editable: true,
        editDefinition: true,
        onchange: () => {},
        ondefinition: () => {}
      }
    });
    for (const label of ['Max HP', 'Hit dice']) {
      expect(screen.getByLabelText(label), `${label} should be editable`).toBeTruthy();
    }
  });

  it('reports a max HP change without disturbing the rest of the definition', async () => {
    const ondefinition = vi.fn();
    render(HitPoints, {
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
    expect(next.combat.ac, 'untouched fields survive the patch').toBe(17);
    expect(next.identity.name).toBe('Loka');
  });
});
