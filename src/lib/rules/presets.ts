/**
 * Ready-made trackers: spell slots by kind of caster, and the class resources
 * players most often track. Each is an ordinary tracker once added, with its
 * maximum written as a formula (see formula.ts) so it follows the class level,
 * and everything about it can still be changed.
 *
 * Numbers follow the 2024 Player's Handbook. Where a die or a rest changes
 * with level, it is set for the level the character has when it is added.
 */
import type { Tracker } from '$lib/types';
import { ordinal } from './spells';

export type Preset = {
  id: string;
  label: string;
  /** The class it belongs to (its trackers are scoped to that class's
      level), or the feat or species it comes from. */
  className: string;
  /** Not a class: a feat or species, listed apart and counting total level. */
  kind?: 'feat' | 'species';
  /** One line on what it adds. */
  blurb: string;
  build: (classLevel: number) => Omit<Tracker, 'id'>[];
};

const slots = (kind: 'full' | 'half' | 'third', className: string, top: number) => (): Omit<Tracker, 'id'>[] =>
  Array.from({ length: top }, (_, i) => ({
    label: `${ordinal(i + 1)}-Level Slots`,
    group: 'Spell slots',
    max: `${kind}(${i + 1})`,
    type: 'pips' as const,
    direction: 'spend' as const,
    reset: { on: 'long' as const, amount: 'full' as const },
    class: className
  }));

const resource = (
  label: string,
  className: string,
  max: string,
  reset: 'short' | 'long',
  extra: Partial<Tracker> = {}
): Omit<Tracker, 'id'> => ({
  label,
  max,
  type: 'pips',
  direction: 'spend',
  reset: { on: reset, amount: 'full' },
  class: className,
  ...extra
});

const dieAt = (level: number, steps: [number, string][]) =>
  steps.reduce((die, [from, d]) => (level >= from ? d : die), steps[0][1]);

export const PRESETS: Preset[] = [
  // Spell slots
  ...(['Bard', 'Cleric', 'Druid', 'Sorcerer', 'Wizard'] as const).map((c) => ({
    id: `slots-${c.toLowerCase()}`,
    label: `${c} Spell Slots`,
    className: c,
    blurb: 'Full caster: 1st to 9th level',
    build: slots('full', c, 9)
  })),
  ...(['Paladin', 'Ranger', 'Artificer'] as const).map((c) => ({
    id: `slots-${c.toLowerCase()}`,
    label: `${c} Spell Slots`,
    className: c,
    blurb: 'Half caster: 1st to 5th level',
    build: slots('half', c, 5)
  })),
  {
    id: 'slots-fighter',
    label: 'Eldritch Knight Spell Slots',
    className: 'Fighter',
    blurb: 'Third caster, from 3rd level: 1st to 4th',
    build: slots('third', 'Fighter', 4)
  },
  {
    id: 'slots-rogue',
    label: 'Arcane Trickster Spell Slots',
    className: 'Rogue',
    blurb: 'Third caster, from 3rd level: 1st to 4th',
    build: slots('third', 'Rogue', 4)
  },
  {
    id: 'pact',
    label: 'Pact Magic Slots',
    className: 'Warlock',
    blurb: 'Back on a short rest; all at one level',
    build: () => [
      resource('Pact Magic Slots', 'Warlock', 'pact()', 'short', {
        group: 'Spell slots'
      })
    ]
  },
  // Class resources
  {
    id: 'rage',
    label: 'Rage',
    className: 'Barbarian',
    blurb: '2 to 6 by level; long rest',
    build: () => [resource('Rage', 'Barbarian', 'at(1, 2, 3, 3, 6, 4, 12, 5, 17, 6)', 'long')]
  },
  {
    id: 'bardic',
    label: 'Bardic Inspiration',
    className: 'Bard',
    blurb: 'Charisma times a day; short rest from 5th',
    build: (lvl) => [resource('Bardic Inspiration', 'Bard', 'max(1, cha)', lvl >= 5 ? 'short' : 'long', {
      die: dieAt(lvl, [[1, 'd6'], [5, 'd8'], [10, 'd10'], [15, 'd12']])
    })]
  },
  {
    id: 'cd-cleric',
    label: 'Channel Divinity (Cleric)',
    className: 'Cleric',
    blurb: '2 to 4 by level; short rest',
    build: () => [resource('Channel Divinity', 'Cleric', 'at(2, 2, 6, 3, 18, 4)', 'short')]
  },
  {
    id: 'cd-paladin',
    label: 'Channel Divinity (Paladin)',
    className: 'Paladin',
    blurb: '2, then 3 from 11th; short rest',
    build: () => [resource('Channel Divinity', 'Paladin', 'at(3, 2, 11, 3)', 'short')]
  },
  {
    id: 'lay-on-hands',
    label: 'Lay on Hands',
    className: 'Paladin',
    blurb: 'A pool of 5 × paladin level',
    build: () => [resource('Lay on Hands', 'Paladin', 'classlevel * 5', 'long', { type: 'gauge' })]
  },
  {
    id: 'wild-shape',
    label: 'Wild Shape',
    className: 'Druid',
    blurb: '2 to 4 by level; short rest',
    build: () => [resource('Wild Shape', 'Druid', 'at(2, 2, 6, 3, 17, 4)', 'short')]
  },
  {
    id: 'focus',
    label: "Monk's Focus (Focus Points)",
    className: 'Monk',
    blurb: 'Monk level, from 2nd; short rest',
    build: () => [resource("Monk's Focus", 'Monk', 'min(classlevel, at(2, 20))', 'short')]
  },
  {
    id: 'sorcery',
    label: 'Font of Magic (Sorcery Points)',
    className: 'Sorcerer',
    blurb: 'Sorcerer level, from 2nd; long rest',
    build: () => [resource('Font of Magic', 'Sorcerer', 'min(classlevel, at(2, 20))', 'long', { type: 'gauge' })]
  },
  {
    id: 'second-wind',
    label: 'Second Wind',
    className: 'Fighter',
    blurb: '2 to 4 by level; short rest',
    build: () => [resource('Second Wind', 'Fighter', 'at(1, 2, 4, 3, 10, 4)', 'short', {
      die: 'd10'
    })]
  },
  {
    id: 'action-surge',
    label: 'Action Surge',
    className: 'Fighter',
    blurb: '1, then 2 from 17th; short rest',
    build: () => [resource('Action Surge', 'Fighter', 'at(2, 1, 17, 2)', 'short')]
  },
  {
    id: 'superiority',
    label: 'Combat Superiority (Battle Master)',
    className: 'Fighter',
    blurb: 'Battle Master: 4 to 6; short rest',
    build: (lvl) => [resource('Combat Superiority', 'Fighter', 'at(3, 4, 7, 5, 15, 6)', 'short', {
      die: dieAt(lvl, [[1, 'd8'], [10, 'd10'], [18, 'd12']])
    })]
  },
  {
    id: 'favored',
    label: "Favored Enemy (Hunter's Mark)",
    className: 'Ranger',
    blurb: 'Free castings: 2 to 6 by level; long rest',
    build: () => [resource('Favored Enemy', 'Ranger', 'at(1, 2, 5, 3, 9, 4, 13, 5, 17, 6)', 'long')]
  },
  {
    id: 'arcane-recovery',
    label: 'Arcane Recovery',
    className: 'Wizard',
    blurb: 'Once a day, after a short rest',
    build: () => [resource('Arcane Recovery', 'Wizard', '1', 'long')]
  },
  // Feats and species: their uses count the character's total level.
  {
    id: 'lucky',
    label: 'Lucky',
    className: 'Lucky',
    kind: 'feat',
    blurb: 'Luck Points: proficiency bonus; long rest',
    build: () => [resource('Luck Points', 'Lucky', 'prof', 'long')]
  },
  {
    id: 'breath-weapon',
    label: 'Breath Weapon',
    className: 'Dragonborn',
    kind: 'species',
    blurb: 'Dragonborn: proficiency bonus; long rest',
    build: (lvl) => [resource('Breath Weapon', 'Dragonborn', 'prof', 'long', {
      die: dieAt(lvl, [[1, '1d10'], [5, '2d10'], [11, '3d10'], [17, '4d10']])
    })]
  },
  {
    id: 'healing-hands',
    label: 'Healing Hands',
    className: 'Aasimar',
    kind: 'species',
    blurb: 'Aasimar: once; long rest',
    build: () => [resource('Healing Hands', 'Aasimar', '1', 'long')]
  },
  {
    id: 'giant-ancestry',
    label: 'Giant Ancestry',
    className: 'Goliath',
    kind: 'species',
    blurb: 'Goliath: proficiency bonus; long rest',
    build: () => [resource('Giant Ancestry', 'Goliath', 'prof', 'long')]
  },
  {
    id: 'adrenaline-rush',
    label: 'Adrenaline Rush',
    className: 'Orc',
    kind: 'species',
    blurb: 'Orc: proficiency bonus; short rest',
    build: () => [resource('Adrenaline Rush', 'Orc', 'prof', 'short')]
  }
];

/**
 * Presets for the classes the character has first, then the rest. A preset is
 * "theirs" when its class is one they have levels in.
 */
export function presetsFor(classNames: string[]): { yours: Preset[]; others: Preset[]; extras: Preset[] } {
  const have = new Set(classNames.map((c) => c.trim().toLowerCase()).filter(Boolean));
  const classed = PRESETS.filter((p) => !p.kind);
  const yours = classed.filter((p) => have.has(p.className.toLowerCase()));
  const others = classed.filter((p) => !have.has(p.className.toLowerCase()));
  return { yours, others, extras: PRESETS.filter((p) => p.kind) };
}

/** The trackers a preset adds, ready to append, with fresh ids. */
export function buildPreset(preset: Preset, classLevel: number, makeId: () => string): Tracker[] {
  return preset.build(classLevel).map((t) => ({ ...t, id: makeId() }));
}
