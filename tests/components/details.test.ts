/** DetailsBlock: the written details that are not numbers. */
import { readFileSync } from 'node:fs';
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

  it('hides empty details from viewers but offers them all to the owner', () => {
    const { unmount } = render(DetailsBlock, {
      props: { definition: definition(), editable: false, onchange: () => {} }
    });
    expect(screen.queryByText('Alignment')).toBeNull();
    unmount();

    render(DetailsBlock, { props: { definition: definition(), editable: true, onchange: () => {} } });
    for (const label of ['Alignment', 'Gender', 'Age']) {
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

  // Background moved to the identity line, player was dropped, and initiative
  // is edited in the defense module where it is read.
  it('no longer carries player, initiative, save DC or proficiencies', () => {
    render(DetailsBlock, {
      props: { definition: definition(), editable: true, onchange: () => {} }
    });
    // Background came back, with its source, in the origin row.
    expect(screen.queryByLabelText('Player')).toBeNull();
    expect(screen.queryByLabelText('Initiative bonus')).toBeNull();
    // Ability save DC is edited in the defense module; proficiencies in the rail.
    expect(screen.queryByLabelText('Ability save DC')).toBeNull();
    expect(screen.queryByLabelText('Proficiencies & languages')).toBeNull();
  });


  it('lets a long answer grow instead of running over what follows', () => {
    // jsdom does no layout, so the guarantee is checked where it is written:
    // the readout takes the shared height as a floor, and the textarea the
    // owner types into follows its content.
    const field = readFileSync('src/lib/components/EditableField.svelte', 'utf8');
    const readout = field.slice(field.indexOf('.readout {'), field.indexOf('input.field'));
    expect(readout).toMatch(/min-height:/);
    expect(readout).toMatch(/height: auto/);

    const block = readFileSync('src/lib/components/DetailsBlock.svelte', 'utf8');
    expect(block).toMatch(/grow=\{true\}/);
  });
});

import { render as renderDetails, screen as detailsScreen } from '@testing-library/svelte';
import DetailsBlockForOrigin from '$lib/components/DetailsBlock.svelte';
describe('origin row', () => {
  it('has species, species source, background and background source, in that order', () => {
    const def = {
      identity: { name: 'X', level: 1, ancestry: 'Tiefling (Glasya)', ancestrySource: 'mtf', background: 'Criminal' },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiency: 2,
      combat: { ac: 10, speed: 30, hpMax: 1, hitDice: '1d8' }, saves: {}, skills: {}, attacks: [], features: [],
      spells: [], trackers: [], equipment: [], currency: {}, notes: ''
    };
    const { container } = renderDetails(DetailsBlockForOrigin, { props: { definition: def as never, editable: true, onchange: () => {} } });
    expect([...container.querySelectorAll('.origin dt')].map((d) => d.textContent)).toEqual([
      'Species', 'Species source', 'Background', 'Background source'
    ]);
    expect((detailsScreen.getByLabelText('Species source') as HTMLInputElement).value).toBe('mtf');
  });
});
