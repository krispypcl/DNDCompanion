import { derived, writable } from 'svelte/store';
import type { State } from '$lib/types';

/**
 * Session-local undo for the misclick: a long rest taken by accident should
 * cost a tap to reverse, not a reconstruction. Deliberately not persisted and
 * deliberately shallow — this is an undo button, not version history.
 */

const LIMIT = 10;

export type UndoEntry = { state: State; label: string };

const stack = writable<UndoEntry[]>([]);

export const canUndo = derived(stack, ($s) => $s.length > 0);
export const lastLabel = derived(stack, ($s) => $s.at(-1)?.label ?? null);

function clone(state: State): State {
  return structuredClone(state);
}

/** Record the state as it was BEFORE the action, with a label naming the action. */
export function snapshot(state: State, label: string) {
  stack.update((s) => [...s, { state: clone(state), label }].slice(-LIMIT));
}

export function undo(): UndoEntry | null {
  let entry: UndoEntry | null = null;
  stack.update((s) => {
    if (s.length === 0) return s;
    entry = s[s.length - 1];
    return s.slice(0, -1);
  });
  return entry;
}

export function resetUndo() {
  stack.set([]);
}
