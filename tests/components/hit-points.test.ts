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

import { fireEvent } from '@testing-library/svelte';

describe('HitPoints for a visitor', () => {
  it('says how the character is doing where the buttons would be', () => {
    const { container } = render(HitPoints, {
      props: { definition: definition(), state: { ...state(), hpCurrent: 20 }, editable: false, onchange: () => {} }
    });
    expect(screen.getByRole('status').textContent).toMatch(/bloodied/i);
    expect(container.textContent).toMatch(/45% of maximum/);
    expect(screen.queryByRole('button', { name: 'Damage' })).toBeNull();
  });

  it('has no status chip for the owner, who has the buttons', () => {
    render(HitPoints, { props: { definition: definition(), state: state(), editable: true, onchange: () => {} } });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('death saves', () => {
  const down = () => ({ ...state(), hpCurrent: 0, deathSaves: { successes: 1, failures: 0 } });

  it('are veiled for the owner too, and the first press only reveals them', async () => {
    const onchange = vi.fn();
    const { container } = render(HitPoints, {
      props: { definition: definition(), state: down(), editable: true, onchange }
    });
    const veil = container.querySelector('.reveal')!;
    expect(veil.classList.contains('veiled')).toBe(true);
    const pip = screen.getByRole('button', { name: 'failures 1' });
    await fireEvent.click(pip);
    expect(onchange).not.toHaveBeenCalled();
    expect(veil.classList.contains('veiled')).toBe(false);
    await fireEvent.click(pip);
    expect(onchange).toHaveBeenCalledTimes(1);
  });

  it('are veiled for a visitor', () => {
    const { container } = render(HitPoints, {
      props: { definition: definition(), state: down(), editable: false, onchange: () => {} }
    });
    expect(container.querySelector('.reveal.veiled')).not.toBeNull();
  });
});

describe('death save cover', () => {
  const down = () => ({ ...state(), hpCurrent: 0, deathSaves: { successes: 2, failures: 1 } });

  it('covers itself again once the pointer leaves, even after a save was marked', async () => {
    const onchange = vi.fn();
    const { container } = render(HitPoints, { props: { definition: definition(), state: down(), editable: true, onchange } });
    const veil = container.querySelector('.reveal') as HTMLElement;
    await fireEvent.pointerEnter(veil, { pointerType: 'mouse' });
    expect(veil.classList.contains('veiled')).toBe(false);
    const pip = screen.getByRole('button', { name: 'successes 3' });
    // A mouse press focuses the button it lands on; that must not hold it open.
    await fireEvent.pointerDown(pip, { pointerType: 'mouse' });
    pip.focus();
    await fireEvent.click(pip);
    expect(onchange).toHaveBeenCalledTimes(1);
    await fireEvent.pointerLeave(veil, { pointerType: 'mouse' });
    expect(veil.classList.contains('veiled')).toBe(true);
  });

  it('covers itself again when a tap lands elsewhere', async () => {
    const { container } = render(HitPoints, { props: { definition: definition(), state: down(), editable: true, onchange: vi.fn() } });
    const veil = container.querySelector('.reveal') as HTMLElement;
    await fireEvent.click(screen.getByRole('button', { name: 'failures 1' }));
    expect(veil.classList.contains('veiled')).toBe(false);
    await fireEvent.pointerDown(document.body);
    expect(veil.classList.contains('veiled')).toBe(true);
  });
});

describe('healing and temporary hit points', () => {
  it('outlines the gauge while there are temporary hit points', async () => {
    const { container, rerender } = render(HitPoints, {
      props: { definition: definition(), state: { ...state(), hpCurrent: 20 }, editable: true, onchange: () => {} }
    });
    expect(container.querySelector('.bar.shielded')).toBeNull();
    await rerender({ definition: definition(), state: { ...state(), hpCurrent: 20, hpTemp: 5 }, editable: true, onchange: () => {} });
    expect(container.querySelector('.bar.shielded')).not.toBeNull();
    expect(container.querySelector('.float.temp')?.textContent).toBe('+5 temp');
  });

  it('marks a heal, and floats the amount healed', async () => {
    const { container, rerender } = render(HitPoints, {
      props: { definition: definition(), state: { ...state(), hpCurrent: 20 }, editable: true, onchange: () => {} }
    });
    await rerender({ definition: definition(), state: { ...state(), hpCurrent: 28 }, editable: true, onchange: () => {} });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await new Promise((r) => setTimeout(r, 30));
    expect(container.querySelector('.hpwrap.healed')).not.toBeNull();
    expect(container.querySelector('.float.heal')?.textContent).toBe('+8');
  });
});

describe('HitPoints at 0', () => {
  it('a hit to 0 adds Incapacitated, and the gauge pulses', async () => {
    const onchange = vi.fn();
    const { container } = render(HitPoints, {
      props: { definition: definition(), state: { ...state(), hpCurrent: 3 }, editable: true, onchange }
    });
    const amount = screen.getByLabelText('Amount') as HTMLInputElement;
    amount.value = '10';
    amount.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
    screen.getByText('Damage').click();
    expect(onchange.mock.calls.at(-1)![0]).toMatchObject({ hpCurrent: 0, conditions: ['Incapacitated'] });
    expect(container.querySelector('.hpwrap.dying')).toBeNull();
  });

  it('pulses while dying, and stops for good when dead', () => {
    const { container, unmount } = render(HitPoints, {
      props: { definition: definition(), state: { ...state(), hpCurrent: 0 }, editable: true, onchange: () => {} }
    });
    expect(container.querySelector('.hpwrap.dying')).not.toBeNull();
    unmount();
    const dead = render(HitPoints, {
      props: { definition: definition(), state: { ...state(), hpCurrent: 0, deathSaves: { successes: 0, failures: 3 } }, editable: true, onchange: () => {} }
    });
    expect(dead.container.querySelector('.hpwrap.dying')).toBeNull();
    expect(dead.container.querySelector('.hpwrap.dead')).not.toBeNull();
  });

  it('a third success brings them back to 1', async () => {
    const onchange = vi.fn();
    const { container } = render(HitPoints, {
      props: {
        definition: definition(),
        state: { ...state(), hpCurrent: 0, conditions: ['Incapacitated'], deathSaves: { successes: 2, failures: 0 } },
        editable: true,
        onchange
      }
    });
    await fireEvent.pointerEnter(container.querySelector('.reveal') as HTMLElement, { pointerType: 'mouse' });
    await fireEvent.click(screen.getByRole('button', { name: 'successes 3' }));
    expect(onchange.mock.calls.at(-1)![0]).toMatchObject({ hpCurrent: 1, conditions: [], deathSaves: { successes: 0, failures: 0 } });
  });
});
