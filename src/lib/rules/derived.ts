/**
 * Every number a reader sees that follows from another number is computed
 * here, never stored. One source of truth is what stops a level-up leaving
 * a dozen stale values behind.
 */

import type { FormulaContext } from './formula';
import { abilityScoreParts, equippedEffects, type Part } from './equipment';
import {
  ABILITIES,
  SKILLS,
  type Ability,
  type ClassEntry,
  type Definition,
  type SkillName
} from '$lib/types';

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** An ability modifier, from the score as equipment leaves it. */
export function modifierOf(def: Definition, ability: Ability): number {
  return abilityModifier(abilityScoreParts(def, ability).score);
}

/**
 * A flat bonus on one saving throw, beyond the ability modifier and
 * proficiency. Kept apart from the total so the sheet can show what was
 * written separately from what it works out to.
 */
export function saveExtra(def: Definition, ability: Ability): number {
  return Number(def.saveBonuses?.[ability]) || 0;
}

export function saveBonus(def: Definition, ability: Ability): number {
  return saveParts(def, ability).reduce((sum, p) => sum + p.value, 0);
}

/** What a saving throw is made of: modifier, proficiency, written bonus, items. */
export function saveParts(def: Definition, ability: Ability): Part[] {
  const parts: Part[] = [{ label: 'Ability modifier', value: modifierOf(def, ability) }];
  if (def.saves?.[ability]) parts.push({ label: 'Proficiency', value: proficiencyBonus(def) });
  const extra = saveExtra(def, ability);
  if (extra) parts.push({ label: 'Written bonus', value: extra });
  for (const { item, effect } of equippedEffects(def)) {
    if (effect.kind === 'save' && (effect.ability === 'all' || effect.ability === ability)) {
      parts.push({ label: item, value: effect.bonus });
    }
  }
  return parts;
}

/**
 * Armor Class, always worked out: the armor's base (or 10 unarmored, or
 * Unarmored Defense) plus Dexterity as the armor allows, shields, and bonuses
 * from items and features.
 */
export function armorClass(def: Definition): { total: number; parts: Part[]; computed: boolean } {
  // Always worked out: from what is worn, or from the body (and the class)
  // when nothing is. Natural armour is worn too: an item with an armour effect.
  const effects = equippedEffects(def).filter(({ effect }) => ['armor', 'shield', 'ac'].includes(effect.kind));
  const dex = modifierOf(def, 'dex');
  const armor = effects.find(({ effect }) => effect.kind === 'armor');
  const shielded = effects.some(({ effect }) => effect.kind === 'shield');
  const parts: Part[] = [];
  if (armor && armor.effect.kind === 'armor') {
    parts.push({ label: armor.item, value: armor.effect.base, note: 'armor' });
    const allowed = armor.effect.dex === 'none' ? 0 : armor.effect.dex === 'max2' ? Math.min(2, dex) : dex;
    if (armor.effect.dex !== 'none') parts.push({ label: armor.effect.dex === 'max2' ? 'Dexterity (up to +2)' : 'Dexterity', value: allowed });
  } else {
    // Unarmoured Defence: a Barbarian adds Constitution, a Monk (without a
    // shield) Wisdom. The better one counts, as the rules have it.
    const levels = classLevels(def);
    const options: { label: string; extra: Part | null }[] = [{ label: 'Unarmored', extra: null }];
    if (levels.barbarian) options.push({ label: 'Unarmored Defense (Barbarian)', extra: { label: 'Constitution', value: modifierOf(def, 'con') } });
    if (levels.monk && !shielded) options.push({ label: 'Unarmored Defense (Monk)', extra: { label: 'Wisdom', value: modifierOf(def, 'wis') } });
    const best = options.reduce((a, b) => ((b.extra?.value ?? 0) > (a.extra?.value ?? 0) ? b : a));
    parts.push({ label: best.label, value: 10 }, { label: 'Dexterity', value: dex });
    if (best.extra) parts.push(best.extra);
  }
  for (const { item, effect } of effects) {
    if (effect.kind === 'shield' || effect.kind === 'ac') parts.push({ label: item, value: effect.bonus });
  }
  return { total: parts.reduce((s, p) => s + p.value, 0), parts, computed: effects.length > 0 };
}

/** Speed: as written, plus anything worn that changes it. */
/** Speed: the species' walking speed (set on the Character tab), plus anything that changes it. */
export function speedParts(def: Definition): { total: number; parts: Part[] } {
  const written = def.combat?.speed == null || def.combat.speed === ('' as unknown) ? 30 : Number(def.combat.speed) || 0;
  const parts: Part[] = [{ label: 'Walking speed', value: written, note: 'species' }];
  for (const { item, effect } of equippedEffects(def)) if (effect.kind === 'speed') parts.push({ label: item, value: effect.bonus });
  return { total: parts.reduce((s, p) => s + p.value, 0), parts };
}

/** Initiative: the Dexterity modifier, plus what items and features add. Never typed. */
export function initiativeParts(def: Definition): { total: number; parts: Part[] } {
  const parts: Part[] = [{ label: 'Dexterity modifier', value: modifierOf(def, 'dex') }];
  for (const { item, effect } of equippedEffects(def)) if (effect.kind === 'init') parts.push({ label: item, value: effect.bonus });
  return { total: parts.reduce((s, p) => s + p.value, 0), parts };
}

export function skillTotal(def: Definition, skill: SkillName): number {
  const base = modifierOf(def, SKILLS[skill]);
  const prof = def.skills?.[skill];
  if (prof?.expertise) return base + proficiencyBonus(def) * 2;
  if (prof?.proficient) return base + proficiencyBonus(def);
  return base;
}

export function passiveScore(def: Definition, skill: SkillName): number {
  return 10 + skillTotal(def, skill);
}

/** What a passive score is made of: 10, the ability, and proficiency or expertise. */
export function passiveParts(def: Definition, skill: SkillName): Part[] {
  const ability = SKILLS[skill];
  const NAMES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' } as const;
  const parts: Part[] = [{ label: 'Base', value: 10 }, { label: NAMES[ability], value: modifierOf(def, ability) }];
  const prof = def.skills?.[skill];
  if (prof?.expertise) parts.push({ label: 'Expertise', value: proficiencyBonus(def) * 2, note: 'twice proficiency' });
  else if (prof?.proficient) parts.push({ label: 'Proficiency', value: proficiencyBonus(def) });
  return parts;
}

export function spellSaveDC(def: Definition, ability: Ability): number {
  return 8 + proficiencyBonus(def) + modifierOf(def, ability);
}

export function spellAttackBonus(def: Definition, ability: Ability): number {
  return proficiencyBonus(def) + modifierOf(def, ability);
}

/**
 * Total weight carried. An item's weight is per unit, so it counts once per
 * item in the stack; an item without a weight counts as none rather than
 * blocking the sum.
 */
export function weightCarried(def: Definition): number {
  const total = (def.equipment ?? []).reduce((sum, item) => {
    const w = Number(item.weight);
    if (!Number.isFinite(w)) return sum;
    const qty = Number(item.qty);
    return sum + w * (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);
  // Keep a half-pound from turning into 7.500000000000001.
  return Math.round(total * 100) / 100;
}

/** The context tracker formulas are evaluated against. */
/**
 * Every class the character has levels in. A sheet written before
 * multiclassing existed has the single-class fields instead, so it reads as
 * one entry rather than as nothing.
 */
export function classList(def: Definition): ClassEntry[] {
  const list = def.identity?.classes;
  if (list && list.length > 0) return list;
  if (!def.identity?.class) return [];
  return [
    { name: def.identity.class, subclass: def.identity.subclass, level: def.identity.level ?? 1 }
  ];
}

/**
 * The proficiency bonus, from total character level (all classes together):
 * +2 at levels 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16, +6 at 17–20. Not
 * typed in: it follows the classes.
 */
export function proficiencyBonus(def: Definition): number {
  const level = Math.max(1, Math.min(20, characterLevel(def) || 1));
  return 2 + Math.floor((level - 1) / 4);
}

/** Total character level: what proficiency and hit dice are keyed to. */
export function characterLevel(def: Definition): number {
  const list = classList(def);
  if (list.length === 0) return def.identity?.level ?? 1;
  return list.reduce((sum, c) => sum + (Number(c.level) || 0), 0);
}

/** Class levels by lower-cased name, for scoping `classlevel` in a formula. */
export function classLevels(def: Definition): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of classList(def)) {
    const key = c.name?.trim().toLowerCase();
    if (!key) continue;
    out[key] = (out[key] ?? 0) + (Number(c.level) || 0);
  }
  return out;
}

/**
 * How a player says it: "White Hat Gunslinger" for one class, and
 * "Gunslinger 5 / Fighter 2" once there is more than one, where the levels
 * are what matter and the subclasses are noise.
 */
export function classLine(def: Definition): string {
  const list = classList(def);
  if (list.length === 0) return '';
  if (list.length === 1) {
    const [only] = list;
    return [only.subclass, only.name].filter(Boolean).join(' ');
  }
  return list.map((c) => `${c.name} ${c.level}`.trim()).join(' / ');
}

export function formulaContext(def: Definition): FormulaContext {
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, modifierOf(def, a)])) as Record<
    Ability,
    number
  >;
  const level = characterLevel(def);
  return {
    level,
    // Overridden per tracker by trackerMax; the total is the sensible default
    // for a tracker that names no class.
    classlevel: level,
    prof: proficiencyBonus(def),
    classLevels: classLevels(def),
    ...mods
  };
}
