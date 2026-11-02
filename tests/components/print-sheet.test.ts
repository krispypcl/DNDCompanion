import { render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import PrintSheet from '$lib/components/PrintSheet.svelte';
import { blankDefinition } from '$lib/sample';
import { emptyState } from '$lib/types';

const sheet = () => document.body.querySelector('.printsheet') as HTMLElement;

describe('PrintSheet', () => {
  afterEach(() => sheet()?.remove());

  it('lays the character out on the paper sheet', () => {
    const def = blankDefinition('Loka Sibbs');
    def.identity.player = 'Chris';
    def.abilities.dex = 18;
    def.attacks = [{ name: 'Revolver', bonus: '+10', damage: '2d6+1', damageType: 'piercing' }];
    def.features = [{ name: 'Second Wind', title: 'Second Wind', body: 'Regain 1d10 + level.' }];
    render(PrintSheet, { props: { definition: def, state: { ...emptyState(), hpCurrent: 28 }, backstory: 'Born in the **Dustlands**.' } });
    const text = sheet().textContent ?? '';
    for (const want of ['Loka Sibbs', 'Chris', 'Revolver', '2d6+1 piercing', 'Second Wind', 'Dustlands', '28']) {
      expect(text).toContain(want);
    }
    expect(sheet().querySelector('.rich strong')?.textContent).toBe('Dustlands');
    // Moved to the body so the printer can show it alone.
    expect(sheet().parentElement).toBe(document.body);
  });

  it('has a spell page only for a caster', () => {
    const def = blankDefinition();
    render(PrintSheet, { props: { definition: def, state: emptyState() } });
    expect(sheet().querySelectorAll('.page')).toHaveLength(2);
    sheet().remove();

    def.spellcastingAbility = 'int';
    def.spells = [{ name: 'Shield', level: '1', prepared: true }];
    render(PrintSheet, { props: { definition: def, state: emptyState() } });
    expect(sheet().querySelectorAll('.page')).toHaveLength(3);
    expect(sheet().textContent).toContain('Shield');
    expect(sheet().textContent).toContain('Intelligence');
  });
});
