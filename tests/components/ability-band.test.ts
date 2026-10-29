/** AbilityBand: abilities and saving throws, under one heading. */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import AbilityBand from '$lib/components/AbilityBand.svelte';
import type { Definition } from '$lib/types';

const definition = (over: Partial<Definition> = {}): Definition => ({
  identity: { name: 'Loka', level: 7 },
  abilities: { str: 12, dex: 18, con: 16, int: 9, wis: 14, cha: 18 },
  proficiency: 3,
  combat: { ac: 17, speed: 30, hpMax: 40, hitDice: '5d8' },
  saves: { dex: true },
  skills: {},
  attacks: [],
  features: [],
  spells: [],
  trackers: [],
  equipment: [],
  currency: {},
  notes: '',
  ...over
});

const props = (def: Definition, editable: boolean) => ({
  definition: def,
  editable,
  onchange: () => {}
});

describe('AbilityBand', () => {
  it('puts abilities and saving throws under one heading', () => {
    render(AbilityBand, { props: props(definition(), false) });
    expect(screen.getByText(/abilities & saving throws/i)).toBeTruthy();
    expect(screen.queryByText(/^saving throws$/i)).toBeNull();
  });

  it('folds a written bonus into the total and shows what was written', () => {
    render(AbilityBand, { props: props(definition({ saveBonuses: { con: 2 } }), false) });
    // CON 16 is +3, not proficient, plus the written 2.
    expect(screen.getByLabelText('Constitution saving throw proficiency').textContent?.trim()).toBe('+5');
    const cell = screen.getByLabelText('Constitution saving throw proficiency').closest('.save');
    expect(cell?.querySelector('.bonus')?.textContent?.trim()).toBe('+2');
  });

  it('shows a dash where nothing was written, so the row keeps its shape', () => {
    render(AbilityBand, { props: props(definition(), false) });
    const cell = screen.getByLabelText('Wisdom saving throw proficiency').closest('.save');
    expect(cell?.querySelector('.bonus')?.textContent?.trim()).toBe('—');
  });

  it('offers a bonus field per ability and no global one', () => {
    render(AbilityBand, { props: props(definition({ saveBonuses: { dex: 1 } }), true) });
    for (const name of ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']) {
      expect(screen.getByLabelText(`${name} saving throw bonus`), name).toBeTruthy();
    }
    expect((screen.getByLabelText('Dexterity saving throw bonus') as HTMLInputElement).value).toBe('1');
    expect(screen.queryByLabelText(/all saves/i)).toBeNull();
  });

  it('clears a bonus rather than writing a zero when the field is emptied', () => {
    let next: Definition | null = null;
    render(AbilityBand, {
      props: {
        definition: definition({ saveBonuses: { con: 2 } }),
        editable: true,
        onchange: (d: Definition) => (next = d)
      }
    });
    const field = screen.getByLabelText('Constitution saving throw bonus') as HTMLInputElement;
    field.value = '';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    expect(next).not.toBeNull();
    expect(next!.saveBonuses).toEqual({});
  });

  it('keeps the ability box free of the rule that used to split it', () => {
    const source = readFileSync('src/lib/components/AbilityBand.svelte', 'utf8');
    const score = source.slice(source.indexOf('.score {'), source.indexOf('.score :global'));
    expect(score).not.toMatch(/border-top/);
  });
});
