/**
 * The sheet's edits that are pure data: what a table's rows become in the
 * definition. Kept apart from the component so they can be read, and tested,
 * on their own.
 */
import { trackerUrl } from '$lib/rules/lookup';
import type { ClassEntry, Definition, RestKind, State, Tracker, TrackerDirection, TrackerType } from '$lib/types';

/** A fresh id for a tracker. */
export function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `t${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Classes are the source; the older single-class fields and the character
 * level are kept in step so existing sheets, the sheet list and `level`
 * formulas all keep working.
 */
export function withClasses(definition: Definition, rows: ClassEntry[]): Definition {
  const list = rows.map((r) => ({
    name: String(r.name ?? ''),
    ...(r.subclass ? { subclass: String(r.subclass) } : {}),
    level: Number(r.level) || 0,
    ...(r.source ? { source: String(r.source) } : {})
  }));
  const total = list.reduce((sum, c) => sum + c.level, 0);
  const [first] = list;
  return {
    ...definition,
    identity: {
      ...definition.identity,
      classes: list,
      class: first?.name ?? definition.identity.class,
      subclass: first?.subclass,
      level: total || definition.identity.level
    }
  };
}

/** A tracker as the trackers table shows it: every field a string. */
export type TrackerRow = {
  id: string;
  label: string;
  max: string;
  die: string;
  type: string;
  direction: string;
  resetOn: string;
  resetAmount: string;
  group: string;
  source: string;
  /** Where it comes from: a class (whose level `classlevel` means), a feat or a species. */
  cls: string;
  /** Shown as its link; never saved. */
  lookupUrl?: string;
};

const numeric = (v: string) => /^-?\d+$/.test(v.trim());
const scalar = (v: string): number | string => (numeric(v) ? Number(v) : v.trim());

export function trackerRows(definition: Definition | undefined, classes: { name: string; source?: string }[]): TrackerRow[] {
  return (definition?.trackers ?? []).map((t) => ({
    id: t.id,
    label: t.label ?? '',
    max: String(t.max ?? ''),
    die: t.die ?? '',
    type: t.type ?? 'pips',
    direction: t.direction ?? 'spend',
    resetOn: t.reset?.on ?? 'manual',
    resetAmount: String(t.reset?.amount ?? 'full'),
    group: t.group ?? '',
    source: t.source ?? '',
    cls: t.class ?? '',
    lookupUrl: trackerUrl(t, classes) ?? undefined
  }));
}

/** Everything the table shows, so what it does not (a description) is kept. */
function withoutShown(t: Tracker | undefined): Partial<Tracker> {
  if (!t) return {};
  const { die: _d, group: _g, source: _s, class: _c, ...rest } = t;
  return rest;
}

/** The trackers from the table's rows: what it shows from the row, the rest as it was. */
export function withTrackerRows(definition: Definition, rows: TrackerRow[]): Definition {
  const before = new Map((definition.trackers ?? []).map((t) => [t.id, t]));
  const trackers: Tracker[] = rows.map((r) => ({
    ...withoutShown(before.get(r.id)),
    id: r.id || newId(),
    label: r.label,
    max: scalar(r.max || '0'),
    ...(r.die ? { die: r.die } : {}),
    type: r.type as TrackerType,
    direction: r.direction as TrackerDirection,
    reset: {
      on: r.resetOn as RestKind | 'manual',
      amount: r.resetAmount.trim() === 'full' ? 'full' : scalar(r.resetAmount || 'full')
    },
    ...(r.group ? { group: r.group } : {}),
    ...(r.source ? { source: r.source } : {}),
    ...(r.cls?.trim() ? { class: r.cls.trim() } : {})
  }));
  return { ...definition, trackers };
}

export function blankTracker(): TrackerRow {
  return {
    id: newId(),
    label: 'New tracker',
    max: '1',
    die: '',
    type: 'pips',
    direction: 'spend',
    resetOn: 'long',
    resetAmount: 'full',
    group: '',
    source: '',
    cls: ''
  };
}

/** Trackers taken off the sheet, with what had been spent from them. */
export function withoutTrackers(definition: Definition, state: State, ids: string[]): { definition: Definition; state: State } {
  const gone = new Set(ids);
  return {
    definition: { ...definition, trackers: (definition.trackers ?? []).filter((t) => !gone.has(t.id)) },
    state: { ...state, trackers: Object.fromEntries(Object.entries(state.trackers ?? {}).filter(([k]) => !gone.has(k))) }
  };
}
