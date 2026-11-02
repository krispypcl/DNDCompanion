import { emptyState, type Definition, type State } from '$lib/types';

/** The shape a new sheet starts in. Empty, not an example character. */
export function blankDefinition(name = 'New character'): Definition {
  return {
    identity: { name, level: 1 },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiency: 2,
    combat: { ac: 10, speed: 30, hpMax: 1, hitDice: '1d8' },
    saves: {},
    skills: {},
    attacks: [],
    features: [],
    spells: [],
    trackers: [],
    equipment: [],
    currency: {},
    traits: {},
    notes: '',
    backstory: ''
  };
}

/** A new sheet starts whole: 1 of 1 hit points, not 0, which reads as down. */
export function blankState(): State {
  return { ...emptyState(), hpCurrent: 1 };
}
