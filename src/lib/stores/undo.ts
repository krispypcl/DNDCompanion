import type { State } from '#lib/types.ts';

/**
 * Session-local undo for the misclick: a long rest taken by accident should
 * cost a tap to reverse, not a reconstruction. Deliberately not persisted and
 * deliberately shallow: the toasts' and rests' Undo, not version history.
 */

const LIMIT = 10;

export type UndoEntry = { state: State; label: string };

/** Oldest first; nothing shows it, so it is a plain list. */
let stack: UndoEntry[] = [];

/** Record the state as it was BEFORE the action, with a label naming the action. */
export function snapshot(state: State, label: string) {
  stack = [...stack, { state: structuredClone(state), label }].slice(-LIMIT);
}

export function undo(): UndoEntry | null {
  return stack.pop() ?? null;
}

export function resetUndo() {
  stack = [];
}
