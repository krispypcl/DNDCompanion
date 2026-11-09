/**
 * What casting needs from the sheet: the spell attack bonus and save DC (as
 * written, or worked out from the casting ability), and the spell slots by
 * level, from the slot trackers.
 */
import { formulaContext, spellAttackBonus, spellSaveDC } from './derived';
import { slotLevel } from './print';
import { trackerMax } from './tracker';
import type { Definition, State } from '$lib/types';

/** Always worked out from the spellcasting ability: modifier + proficiency. */
export function spellAttack(definition: Definition | undefined): number | null {
  if (!definition?.spellcastingAbility) return null;
  return spellAttackBonus(definition, definition.spellcastingAbility);
}

/** Always worked out: 8 + proficiency + the spellcasting modifier. */
export function spellDc(definition: Definition | undefined): number | null {
  if (!definition?.spellcastingAbility) return null;
  return spellSaveDC(definition, definition.spellcastingAbility);
}

export type SlotLevel = { max: number; left: number; trackers: { id: string; room: number }[] };

/** Spell slots by level: how many each has, how many are left, and which trackers hold them. */
export function slotsByLevel(definition: Definition | undefined, state: State | undefined): Map<number, SlotLevel> {
  const out = new Map<number, SlotLevel>();
  if (!definition || !state) return out;
  const ctx = formulaContext(definition);
  for (const t of definition.trackers ?? []) {
    const level = slotLevel(t);
    if (level === null || t.direction === 'accrue') continue;
    let max = 0;
    try { max = trackerMax(t, ctx); } catch { continue; }
    const spent = Math.min(max, Number(state.trackers?.[t.id]) || 0);
    const at = out.get(level) ?? { max: 0, left: 0, trackers: [] };
    at.max += max;
    at.left += max - spent;
    at.trackers.push({ id: t.id, room: max - spent });
    out.set(level, at);
  }
  return out;
}
