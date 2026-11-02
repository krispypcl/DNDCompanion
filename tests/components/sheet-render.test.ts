import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import AbilityBand from '$lib/components/AbilityBand.svelte';
import HitPoints from '$lib/components/HitPoints.svelte';
import SkillRail from '$lib/components/SkillRail.svelte';
import Tracker from '$lib/components/Tracker.svelte';
import { formulaContext } from '$lib/rules/derived';
import { emptyState, type Definition, type Tracker as TrackerT } from '$lib/types';

/** Loka Sibbs at level 5, straight off the real sheet. */
const loka: Definition = {
  identity: { name: 'Loka Sibbs', class: 'Gunslinger', subclass: 'White Hat', level: 5 },
  abilities: { str: 12, dex: 18, con: 16, int: 9, wis: 14, cha: 18 },
  proficiency: 3,
  combat: { ac: 16, speed: 30, hpMax: 40, hitDice: '5d8' },
  saves: { dex: true, cha: true },
  skills: {
    acrobatics: { proficient: true },
    deception: { proficient: true },
    sleightOfHand: { proficient: true },
    stealth: { proficient: true }
  },
  attacks: [{ name: 'Blessed Revolver', bonus: '+10', damage: '2d6+1 piercing' }],
  features: [],
  spells: [],
  trackers: [],
  equipment: [],
  currency: {},
  notes: ''
};

const riskDice: TrackerT = {
  id: 'risk',
  label: 'Risk Dice',
  max: 4,
  die: 'd8',
  type: 'pips',
  direction: 'spend',
  reset: { on: 'short', amount: 'full' }
};

describe('the sheet renders real numbers', () => {
  test('the ability band leads with modifiers and keeps the scores', () => {
    const { container } = render(AbilityBand, {
      props: { definition: loka, editable: false, onchange: () => {} }
    });
    const text = container.textContent ?? '';
    expect(text).toContain('+4');   // DEX 18 modifier
    expect(text).toContain('18');   // the score itself, smaller
    expect(text).toContain('+7');   // DEX save: proficient, 4 + 3
    expect(text).toContain('+3');   // CON save: not proficient
  });

  test('the skill rail shows totals', () => {
    const { container } = render(SkillRail, {
      props: { definition: loka, editable: false, onchange: () => {} }
    });
    const text = container.textContent ?? '';
    expect(text).toContain('Stealth');
    expect(text).toContain('+7');          // DEX 4 + prof 3
  });

  test('the hit point module shows HP out of max and the hit dice', () => {
    const state = { ...emptyState(), hpCurrent: 40 };
    const { container } = render(HitPoints, {
      props: { definition: loka, state, editable: false, onchange: () => {} }
    });
    const text = container.textContent ?? '';
    expect(text).toContain('/ 40');
    expect(text).toContain('5d8');
  });

  test('a pips tracker renders one button per point', () => {
    const { container } = render(Tracker, {
      props: {
        tracker: riskDice,
        spent: 1,
        ctx: formulaContext(loka),
        editable: true,
        onchange: () => {}
      }
    });
    expect(container.querySelectorAll('.pip')).toHaveLength(4);
    expect(container.textContent).toContain('Risk Dice');
    expect(container.textContent).toContain('d8');
    expect(container.textContent).toContain('3');   // 4 max, 1 spent
  });

  test('a formula max follows the character', () => {
    const ki: TrackerT = { ...riskDice, id: 'ki', label: 'Ki', max: 'level', die: undefined };
    const { container } = render(Tracker, {
      props: { tracker: ki, spent: 0, ctx: formulaContext(loka), editable: true, onchange: () => {} }
    });
    expect(container.querySelectorAll('.pip')).toHaveLength(5); // level 5
  });

  test('a broken formula shows an error instead of silently reading zero', () => {
    const broken: TrackerT = { ...riskDice, id: 'bad', max: 'wisdom' };
    const { container } = render(Tracker, {
      props: { tracker: broken, spent: 0, ctx: formulaContext(loka), editable: true, onchange: () => {} }
    });
    expect(container.textContent).toContain('Formula error');
  });
});
