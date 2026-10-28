/** DetailsBlock: the written details that are not numbers. */
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import DetailsBlock from '$lib/components/DetailsBlock.svelte';
import type { Definition } from '$lib/types';

const definition = (identity: Partial<Definition['identity']> = {}): Definition => ({
  identity: { name: 'Loka', level: 5, ...identity },
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

describe('DetailsBlock', () => {
  it('falls back to the DEX modifier when no initiative bonus is written', () => {
    render(DetailsBlock, { props: { definition: definition(), editable: false, onchange: () => {} } });
    expect(screen.getByText('+4')).toBeTruthy();
  });

  it('hides empty details from viewers but offers them all to the owner', () => {
    const { unmount } = render(DetailsBlock, {
      props: { definition: definition(), editable: false, onchange: () => {} }
    });
    expect(screen.queryByText('Alignment')).toBeNull();
    unmount();

    render(DetailsBlock, { props: { definition: definition(), editable: true, onchange: () => {} } });
    for (const label of ['Alignment', 'Gender', 'Age', 'Initiative bonus', 'Portrait URL']) {
      expect(screen.getByLabelText(label), `${label} should be editable`).toBeTruthy();
    }
  });

  it('shows a filled detail to a viewer', () => {
    render(DetailsBlock, {
      props: { definition: definition({ alignment: 'Chaotic neutral' }), editable: false, onchange: () => {} }
    });
    expect(screen.getByText('Alignment')).toBeTruthy();
    expect(screen.getByText('Chaotic neutral')).toBeTruthy();
  });

  // Background moved to the identity line; player was dropped.
  it('no longer carries background or player', () => {
    render(DetailsBlock, {
      props: { definition: definition(), editable: true, onchange: () => {} }
    });
    expect(screen.queryByLabelText('Background')).toBeNull();
    expect(screen.queryByLabelText('Player')).toBeNull();
  });

  it('renders the portrait when one is set', () => {
    render(DetailsBlock, {
      props: {
        definition: definition({ portraitUrl: 'https://example.test/loka.png' }),
        editable: false,
        onchange: () => {}
      }
    });
    expect(screen.getByAltText('Portrait of Loka')).toBeTruthy();
  });

  it('clears the initiative override when the field is emptied', () => {
    const onchange = vi.fn();
    render(DetailsBlock, {
      props: { definition: { ...definition(), combat: { ac: 17, speed: 30, hpMax: 44, hitDice: '5d10', initiative: 7 } }, editable: true, onchange }
    });
    const field = screen.getByLabelText('Initiative bonus') as HTMLInputElement;
    field.value = '';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    expect((onchange.mock.calls.at(-1)![0] as Definition).combat.initiative).toBeUndefined();
  });
});
