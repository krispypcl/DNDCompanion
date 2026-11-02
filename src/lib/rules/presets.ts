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
  /** The class it belongs to; its trackers are scoped to that class's level. */
  className: string;
  /** One line on what it adds. */
  blurb: string;
  build: (classLevel: number) => Omit<Tracker, 'id'>[];
};

const slots = (kind: 'full' | 'half' | 'third', className: string, top: number) => (): Omit<Tracker, 'id'>[] =>
  Array.from({ length: top }, (_, i) => ({
    label: `${ordinal(i + 1)}-level slots`,
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
    label: `${c} spell slots`,
    className: c,
    blurb: 'Full caster: 1st to 9th level',
    build: slots('full', c, 9)
  })),
  ...(['Paladin', 'Ranger', 'Artificer'] as const).map((c) => ({
    id: `slots-${c.toLowerCase()}`,
    label: `${c} spell slots`,
    className: c,
    blurb: 'Half caster: 1st to 5th level',
    build: slots('half', c, 5)
  })),
  {
    id: 'slots-fighter',
    label: 'Eldritch Knight spell slots',
    className: 'Fighter',
    blurb: 'Third caster, from 3rd level: 1st to 4th',
    build: slots('third', 'Fighter', 4)
  },
  {
    id: 'slots-rogue',
    label: 'Arcane Trickster spell slots',
    className: 'Rogue',
    blurb: 'Third caster, from 3rd level: 1st to 4th',
    build: slots('third', 'Rogue', 4)
  },
  {
    id: 'pact',
    label: 'Pact Magic slots',
    className: 'Warlock',
    blurb: 'Back on a short rest; all at one level',
    build: (lvl) => [
      resource('Pact Magic slots', 'Warlock', 'pact()', 'short', {
        group: 'Spell slots',
        description: `All cast at ${ordinal(Math.min(5, Math.max(1, Math.ceil(lvl / 2))))} level now; that rises every two levels to 5th.`
      })
    ]
  },
  // Class resources
  {
    id: 'rage',
    label: 'Rage',
    className: 'Barbarian',
    blurb: '2 to 6 by level; long rest',
    build: () => [resource('Rage', 'Barbarian', 'at(1, 2, 3, 3, 6, 4, 12, 5, 17, 6)', 'long', {
      description: 'One comes back on a short rest.'
    })]
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
    build: () => [resource('Wild Shape', 'Druid', 'at(2, 2, 6, 3, 17, 4)', 'short', {
      description: 'One comes back on a short rest; all on a long rest.'
    })]
  },
  {
    id: 'focus',
    label: 'Focus Points (Ki)',
    className: 'Monk',
    blurb: 'Monk level, from 2nd; short rest',
    build: () => [resource('Focus Points', 'Monk', 'min(classlevel, at(2, 20))', 'short')]
  },
  {
    id: 'sorcery',
    label: 'Sorcery Points',
    className: 'Sorcerer',
    blurb: 'Sorcerer level, from 2nd; long rest',
    build: () => [resource('Sorcery Points', 'Sorcerer', 'min(classlevel, at(2, 20))', 'long', { type: 'gauge' })]
  },
  {
    id: 'second-wind',
    label: 'Second Wind',
    className: 'Fighter',
    blurb: '2 to 4 by level; short rest',
    build: () => [resource('Second Wind', 'Fighter', 'at(1, 2, 4, 3, 10, 4)', 'short', {
      die: 'd10',
      description: 'One comes back on a short rest; all on a long rest.'
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
    label: 'Superiority Dice',
    className: 'Fighter',
    blurb: 'Battle Master: 4 to 6; short rest',
    build: (lvl) => [resource('Superiority Dice', 'Fighter', 'at(3, 4, 7, 5, 15, 6)', 'short', {
      die: dieAt(lvl, [[1, 'd8'], [10, 'd10'], [18, 'd12']])
    })]
  },
  {
    id: 'favored',
    label: "Favored Enemy (Hunter's Mark)",
    className: 'Ranger',
    blurb: 'Free castings: 2 to 6 by level; long rest',
    build: () => [resource("Hunter's Mark", 'Ranger', 'at(1, 2, 5, 3, 9, 4, 13, 5, 17, 6)', 'long')]
  },
  {
    id: 'arcane-recovery',
    label: 'Arcane Recovery',
    className: 'Wizard',
    blurb: 'Once a day, after a short rest',
    build: () => [resource('Arcane Recovery', 'Wizard', '1', 'long', {
      description: 'Recover slots totalling up to half your wizard level (rounded up), none above 5th.'
    })]
  }
];

/**
 * Presets for the classes the character has first, then the rest. A preset is
 * "theirs" when its class is one they have levels in.
 */
export function presetsFor(classNames: string[]): { yours: Preset[]; others: Preset[] } {
  const have = new Set(classNames.map((c) => c.trim().toLowerCase()).filter(Boolean));
  const yours = PRESETS.filter((p) => have.has(p.className.toLowerCase()));
  const others = PRESETS.filter((p) => !have.has(p.className.toLowerCase()));
  return { yours, others };
}

/** The trackers a preset adds, ready to append, with fresh ids. */
export function buildPreset(preset: Preset, classLevel: number, makeId: () => string): Tracker[] {
  return preset.build(classLevel).map((t) => ({ ...t, id: makeId() }));
}
