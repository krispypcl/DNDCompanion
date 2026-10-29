/**
 * Every number a reader sees that follows from another number is computed
 * here, never stored. One source of truth is what stops a level-up leaving
 * a dozen stale values behind.
 */

import type { FormulaContext } from './formula';
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

export function modifierOf(def: Definition, ability: Ability): number {
  return abilityModifier(def.abilities[ability] ?? 10);
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
  const base = modifierOf(def, ability);
  const prof = def.saves?.[ability] ? def.proficiency : 0;
  return base + prof + saveExtra(def, ability);
}

export function skillTotal(def: Definition, skill: SkillName): number {
  const base = modifierOf(def, SKILLS[skill]);
  const prof = def.skills?.[skill];
  if (prof?.expertise) return base + def.proficiency * 2;
  if (prof?.proficient) return base + def.proficiency;
  return base;
}

export function passiveScore(def: Definition, skill: SkillName): number {
  return 10 + skillTotal(def, skill);
}

export function spellSaveDC(def: Definition, ability: Ability): number {
  return 8 + def.proficiency + modifierOf(def, ability);
}

export function spellAttackBonus(def: Definition, ability: Ability): number {
  return def.proficiency + modifierOf(def, ability);
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
    prof: def.proficiency,
    classLevels: classLevels(def),
    ...mods
  };
}
