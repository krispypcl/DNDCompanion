/**
 * Rolls made on a sheet, as the Owlbear room hears of them: who rolled, what
 * for, the total, and the dice, shown to everyone in the room as a pop-up.
 * Kept small, as they travel on a broadcast.
 */
import type { Roll } from '#lib/rules/dice.ts';

export type RollNote = {
  sheet: string;
  who: string;
  label: string;
  total: number;
  formula: string;
  /** Each die: its sides, the face that counts, and a dropped d20 if any. */
  dice: { s: number; v: number; d?: number }[];
  mode: 'normal' | 'advantage' | 'disadvantage';
  at: number;
};

export function noteOf(roll: Roll, sheet: string, who: string): RollNote {
  return {
    sheet,
    who: who.trim().slice(0, 60) || 'Someone',
    label: (roll.label ?? '').trim().slice(0, 80),
    total: roll.total,
    formula: roll.formula.slice(0, 60),
    dice: roll.dice.slice(0, 20).map((d) => (d.dropped !== undefined ? { s: d.sides, v: d.value, d: d.dropped } : { s: d.sides, v: d.value })),
    mode: roll.pool.mode,
    at: roll.at
  };
}

/** A note as it came over the wire, or null if it is not one. */
export function readNote(value: unknown): RollNote | null {
  const n = value as RollNote;
  if (!n || typeof n !== 'object' || typeof n.sheet !== 'string' || typeof n.total !== 'number' || !Array.isArray(n.dice)) return null;
  return {
    sheet: n.sheet,
    who: String(n.who ?? 'Someone').slice(0, 60),
    label: String(n.label ?? '').slice(0, 80),
    total: n.total,
    formula: String(n.formula ?? '').slice(0, 60),
    dice: n.dice.slice(0, 20).map((d) => ({ s: Number(d.s) || 0, v: Number(d.v) || 0, ...(d.d !== undefined ? { d: Number(d.d) } : {}) })),
    mode: n.mode === 'advantage' || n.mode === 'disadvantage' ? n.mode : 'normal',
    at: Number(n.at) || Date.now()
  };
}

/** A natural 20 or a natural 1 on the d20 that counted. */
export function natural(note: RollNote): 'crit' | 'fumble' | null {
  const d20 = note.dice.find((d) => d.s === 20);
  if (!d20 || note.dice.filter((d) => d.s === 20).length !== 1) return null;
  return d20.v === 20 ? 'crit' : d20.v === 1 ? 'fumble' : null;
}

/** "Loka rolled Stealth: 17", with the dice after it in the pop-up. */
export function headline(note: RollNote): string {
  const what = note.label ? ` ${note.label}` : '';
  const nat = natural(note);
  const flourish = nat === 'crit' ? ' (natural 20!)' : nat === 'fumble' ? ' (natural 1!)' : '';
  return `${note.who} rolled${what}: ${note.total}${flourish}`;
}

export function diceLine(note: RollNote): string {
  const faces = note.dice.map((d) => (d.d !== undefined ? `${d.v} (${d.d})` : String(d.v))).join(', ');
  const mode = note.mode === 'advantage' ? ' with advantage' : note.mode === 'disadvantage' ? ' with disadvantage' : '';
  return `${note.formula}${mode}${faces ? ` · ${faces}` : ''}`;
}
