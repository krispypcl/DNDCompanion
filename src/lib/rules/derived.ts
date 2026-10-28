/**
 * Every number a reader sees that follows from another number is computed
 * here, never stored. One source of truth is what stops a level-up leaving
 * a dozen stale values behind.
 */

import type { FormulaContext } from './formula';
import { ABILITIES, SKILLS, type Ability, type Definition, type SkillName } from '$lib/types';

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function modifierOf(def: Definition, ability: Ability): number {
  return abilityModifier(def.abilities[ability] ?? 10);
}

export function saveBonus(def: Definition, ability: Ability): number {
  const base = modifierOf(def, ability);
  return def.saves?.[ability] ? base + def.proficiency : base;
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

/** The context tracker formulas are evaluated against. */
export function formulaContext(def: Definition): FormulaContext {
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, modifierOf(def, a)])) as Record<
    Ability,
    number
  >;
  return { level: def.identity.level, prof: def.proficiency, ...mods };
}
