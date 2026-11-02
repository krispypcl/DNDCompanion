/**
 * What the printed sheet needs that the screen does not: spell slots read out
 * of the trackers so they can sit on the spell page by level, as the paper
 * sheet has them, and everything else a tracker counts listed as boxes to
 * tick at the table.
 */
import type { Definition, State, Tracker } from '$lib/types';
import { formulaContext } from './derived';
import { spellLevel, spellRank } from './spells';
import { clampSpent, trackerMax } from './tracker';

/** Above this many, boxes stop being quicker to read than a number. */
export const MAX_BOXES = 20;

/**
 * The spell level a tracker holds slots for, or null when it is not a slot
 * tracker. "1st-level slots", "Spell Slots · 3rd", "Pact slots (5th)" and a
 * tracker labelled "2nd" in a group called "Spell slots" all count.
 */
export function slotLevel(tracker: Pick<Tracker, 'label' | 'group'>): number | null {
  const text = `${tracker.label ?? ''} ${tracker.group ?? ''}`;
  if (!/slot/i.test(text)) return null;
  const m = String(tracker.label ?? '').match(/\b([1-9])(?:st|nd|rd|th)?\b/) ?? text.match(/\b([1-9])(?:st|nd|rd|th)?\b/);
  return m ? Number(m[1]) : null;
}

export type Counted = { label: string; max: number; used: number; die?: string; reset: string };

function safeMax(tracker: Tracker, ctx: ReturnType<typeof formulaContext>): number {
  try {
    return trackerMax(tracker, ctx);
  } catch {
    return 0;
  }
}

const RESET: Record<string, string> = { short: 'Short rest', long: 'Long rest', dawn: 'Dawn', manual: '' };

/** Slots by level (several trackers for one level add up) and the rest as resources. */
export function countedForPrint(def: Definition, state: State) {
  const ctx = formulaContext(def);
  const slots: Record<number, { max: number; used: number }> = {};
  const resources: Counted[] = [];
  for (const t of def.trackers ?? []) {
    const max = safeMax(t, ctx);
    const used = clampSpent(Number(state.trackers?.[t.id]) || 0, max);
    const level = slotLevel(t);
    if (level !== null) {
      const at = (slots[level] ??= { max: 0, used: 0 });
      at.max += max;
      at.used += used;
    } else {
      resources.push({ label: t.label, max, used, die: t.die, reset: RESET[t.reset?.on] ?? '' });
    }
  }
  return { slots, resources };
}

export type SpellBlock = {
  /** 0 for cantrips, 1–9 for a level, null for anything else. */
  level: number | null;
  title: string;
  spells: Definition['spells'];
  slots?: { max: number; used: number };
};

/**
 * The spell page's boxes: cantrips, then each level that has a spell or a
 * slot, then whatever was written as something other than a level.
 */
export function spellBlocks(def: Definition, slots: Record<number, { max: number; used: number }>): SpellBlock[] {
  const by = new Map<number, Definition['spells']>();
  const other: Definition['spells'] = [];
  for (const s of def.spells ?? []) {
    const level = spellLevel(s.level);
    if (level === null) other.push(s);
    else by.set(level, [...(by.get(level) ?? []), s]);
  }
  const out: SpellBlock[] = [];
  for (let level = 0; level <= 9; level++) {
    const spells = by.get(level) ?? [];
    const slot = level > 0 ? slots[level] : undefined;
    if (spells.length === 0 && !slot) continue;
    out.push({ level, title: level === 0 ? 'Cantrips' : `Level ${level}`, spells, ...(slot ? { slots: slot } : {}) });
  }
  // Homebrew levels above ninth keep their own box, in order.
  for (const [level, spells] of [...by].filter(([l]) => l > 9).sort((a, b) => a[0] - b[0])) {
    out.push({ level, title: `Level ${level}`, spells });
  }
  if (other.length) {
    other.sort((a, b) => spellRank(a.level) - spellRank(b.level));
    out.push({ level: null, title: 'Other', spells: other });
  }
  return out;
}
