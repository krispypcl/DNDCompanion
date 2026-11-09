/**
 * What equipped items do to the numbers, and the parts each number is made
 * of, for the pop-ups that say why a number is what it is. An item counts
 * only while it is equipped; one with no effects written in changes nothing.
 */
import type { Ability, Definition, Item, ItemEffect } from '$lib/types';

export type Part = { label: string; value: number; note?: string };

/**
 * Everything that changes the numbers, with the name of where it comes
 * from: each equipped item's effects, then each feature's (a feature is
 * always on). Items first, so worn armour comes before a feature's natural
 * armour.
 */
export function equippedEffects(def: Definition): { item: string; effect: ItemEffect }[] {
  const worn = (def.equipment ?? [])
    .filter((it: Item) => it.equipped)
    .flatMap((it: Item) => (it.effects ?? []).map((effect) => ({ item: it.name || 'An item', effect })));
  const features = (def.features ?? []).flatMap((f) => (f.effects ?? []).map((effect) => ({ item: f.title || 'A feature', effect })));
  return [...worn, ...features];
}

/** Where advantage on initiative, or on one ability's saves, comes from. */
export function advantageFrom(def: Definition, on: 'init' | 'save', ability?: Ability): string[] {
  return equippedEffects(def)
    .filter(({ effect }) => effect.kind === 'advantage' && effect.on === on &&
      (on === 'init' || !effect.ability || effect.ability === 'all' || effect.ability === ability))
    .map(({ item }) => item);
}

const NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
};

/**
 * An ability score with what equipment does to it: an item that sets a
 * score (Gauntlets of Ogre Power) counts only if it is higher; bonuses add.
 */
export function abilityScoreParts(def: Definition, ability: Ability): { score: number; parts: Part[] } {
  const written = Number(def.abilities?.[ability] ?? 10) || 10;
  let score = written;
  const parts: Part[] = [{ label: `${NAMES[ability]} as written`, value: written }];
  for (const { item, effect } of equippedEffects(def)) {
    if (effect.kind !== 'ability' || effect.ability !== ability) continue;
    if (effect.mode === 'set') {
      if (effect.value > score) {
        parts.push({ label: item, value: effect.value - score, note: `sets it to ${effect.value}` });
        score = effect.value;
      }
    } else {
      parts.push({ label: item, value: effect.value });
      score += effect.value;
    }
  }
  return { score, parts };
}

/** Light, medium and heavy armour from the core rules, by name, to fill in the prompt. */
const ARMOR: [RegExp, number, 'full' | 'max2' | 'none'][] = [
  [/padded/i, 11, 'full'], [/studded/i, 12, 'full'], [/leather/i, 11, 'full'],
  [/hide/i, 12, 'max2'], [/chain\s*shirt/i, 13, 'max2'], [/scale/i, 14, 'max2'], [/breastplate/i, 14, 'max2'],
  [/half\s*plate/i, 15, 'max2'], [/ring\s*mail/i, 14, 'none'], [/chain\s*mail/i, 16, 'none'],
  [/splint/i, 17, 'none'], [/plate/i, 18, 'none']
];
/** A guess at what an item does, from its name, for the equip prompt to start from. */
export function guessEffects(name: string): ItemEffect[] {
  const n = name.trim();
  const plus = Number(n.match(/\+(\d)/)?.[1] ?? 0);
  if (/shield/i.test(n)) return [{ kind: 'shield', bonus: 2 + plus }];
  for (const [re, base, dex] of ARMOR) {
    if (re.test(n)) return [{ kind: 'armor', base: base + plus, dex }];
  }
  if (/ring of protection|cloak of protection/i.test(n)) {
    return [{ kind: 'ac', bonus: 1 }, { kind: 'save', ability: 'all', bonus: 1 }];
  }
  if (/boots of speed|winged boots/i.test(n)) return [];
  return [];
}

const ABILITY_NAMES: Record<Ability, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
const profWords = (p?: 'half' | 'full') => (p === 'full' ? ' plus proficiency' : p === 'half' ? ' plus half proficiency' : '');

/** What effects do, in words, a line each, for the pop-up on an Effects or Equipped tag. */
export function describeEffects(effects: ItemEffect[] = []): string[] {
  return effects.map((e) => {
    switch (e.kind) {
      case 'armor':
        return `Armor: AC ${e.base}${e.dex === 'full' ? ' + Dexterity' : e.dex === 'max2' ? ' + Dexterity (up to +2)' : ''}`;
      case 'shield':
        return `Shield: AC ${signed(e.bonus)}`;
      case 'ac':
        return `Armor Class ${signed(e.bonus)}`;
      case 'speed':
        return `Speed ${signed(e.bonus)} ft.`;
      case 'init':
        return e.bonus || !e.prof ? `Initiative ${signed(e.bonus)}${profWords(e.prof)}` : `Initiative${profWords(e.prof)}`;
      case 'save': {
        const which = e.ability === 'all' ? 'All saving throws' : `${ABILITY_NAMES[e.ability]} saves`;
        return e.bonus || !e.prof ? `${which} ${signed(e.bonus)}${profWords(e.prof)}` : `${which}${profWords(e.prof)}`;
      }
      case 'ability':
        return e.mode === 'set' ? `${ABILITY_NAMES[e.ability]} becomes ${e.value}` : `${ABILITY_NAMES[e.ability]} ${signed(e.value)}`;
      case 'advantage':
        return e.on === 'init' ? 'Advantage on initiative'
          : `Advantage on ${!e.ability || e.ability === 'all' ? 'all saving throws' : `${ABILITY_NAMES[e.ability]} saves`}`;
    }
  });
}
