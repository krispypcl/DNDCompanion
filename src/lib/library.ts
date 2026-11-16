/**
 * The shared library: rows other players have written, offered while you type
 * a name. Each owner's sheets share their rows (without their name) when they
 * open a sheet and when they finish editing; anyone typing the same name gets
 * the versions most sheets use, best first. Only players in a campaign with
 * the person who first wrote an entry see who that was.
 *
 * The database side is migration 0013 (schema.sql, "The shared library").
 * If the library can't be reached, typing and saving go on as normal.
 */
import { get } from 'svelte/store';
import { profile, saveProfile, type ProfileRow } from '$lib/stores/profile';
import { supabase } from '$lib/supabase';
import { trackerRows, type TrackerRow } from '$lib/sheet/edits';
import type { Definition } from '$lib/types';

export type LibraryKind = 'attacks' | 'spells' | 'items' | 'features' | 'trackers';

/** Which field of a row is its name. */
const NAME_KEY: Record<LibraryKind, string> = {
  attacks: 'name',
  spells: 'name',
  items: 'name',
  features: 'title',
  trackers: 'label'
};

/**
 * What belongs to one character and not to the entry: whether a spell is
 * prepared, how many of an item they carry, a row's own id. Never shared,
 * and kept as it is when a row is filled from the library.
 */
const PERSONAL: Record<LibraryKind, string[]> = {
  attacks: [],
  spells: ['prepared'],
  items: ['qty', 'attuned', 'equipped'],
  features: [],
  trackers: ['group']
};
const NEVER = ['id', 'entryId', 'lookupUrl'];

/** What each field is called, for telling versions apart. */
export const FIELD_LABELS: Record<LibraryKind, Record<string, string>> = {
  attacks: { bonus: 'Hit', damage: 'Damage', damageType: 'Type', notes: 'Notes', source: 'Source' },
  spells: {
    level: 'Level', time: 'Cast time', range: 'Range', components: 'Components', duration: 'Duration',
    save: 'Save', damage: 'Roll', notes: 'Notes', source: 'Source'
  },
  items: { weight: 'Weight', value: 'Value', notes: 'Notes', effects: 'Effects', source: 'Source' },
  features: { kind: 'Type', body: 'Description', effects: 'Effects', source: 'Source' },
  trackers: {
    max: 'Max', cls: 'From', die: 'Die', type: 'Shape', direction: 'Direction', resetOn: 'Resets on',
    resetAmount: 'Refill', source: 'Source'
  }
};

export type LibraryRow = { kind: LibraryKind; name: string; data: Record<string, unknown> };

export type Suggestion = {
  id: string;
  name: string;
  data: Record<string, unknown>;
  /** How many sheets have it now. */
  uses: number;
  /** You wrote it first. */
  mine: boolean;
  /** Who wrote it first, for players in a campaign with them; otherwise null. */
  author: string | null;
};

const clean = (v: unknown): unknown => {
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? undefined : t;
  }
  if (Array.isArray(v)) return v.length ? v : undefined;
  return v === null ? undefined : v;
};

/** A row as the library keeps it, or null for a row without a name. */
export function libraryRow(kind: LibraryKind, row: Record<string, unknown>): LibraryRow | null {
  const nameKey = NAME_KEY[kind];
  const name = String(row[nameKey] ?? '').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 120) return null;
  const drop = new Set([...NEVER, ...PERSONAL[kind]]);
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(row).sort()) {
    if (drop.has(key)) continue;
    const value = clean(row[key]);
    if (value !== undefined) data[key] = value;
  }
  data[nameKey] = name;
  // A row with nothing but its name teaches nobody anything.
  if (Object.keys(data).length < 2) return null;
  return { kind, name, data };
}

/** Everything a sheet would share. */
export function sheetLibraryRows(definition: Definition, classes: { name: string; source?: string }[] = []): LibraryRow[] {
  const rows: LibraryRow[] = [];
  const add = (kind: LibraryKind, list: unknown[] | undefined) => {
    for (const item of list ?? []) {
      const r = libraryRow(kind, item as Record<string, unknown>);
      if (r) rows.push(r);
    }
  };
  add('attacks', definition.attacks);
  add('spells', definition.spells);
  add('items', definition.equipment);
  add('features', definition.features);
  add('trackers', trackerRows(definition, classes) as unknown as TrackerRow[]);
  return rows.slice(0, 400);
}

/** Filling a row from an entry: the entry's fields, the character's own kept. */
export function fillRow<T extends Record<string, unknown>>(kind: LibraryKind, row: T, data: Record<string, unknown>): T {
  const keep = new Set([...NEVER, ...PERSONAL[kind]]);
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (keep.has(k)) next[k] = v;
  for (const [k, v] of Object.entries(data)) if (!keep.has(k)) next[k] = v;
  return next as T;
}

/** How a version differs from another of the same name, field by field. */
export function differences(kind: LibraryKind, a: Record<string, unknown>, b: Record<string, unknown>): string[] {
  const labels = FIELD_LABELS[kind];
  return Object.keys(labels).filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
}

/** A version in a line: its most telling fields. */
export function summary(kind: LibraryKind, data: Record<string, unknown>, only?: string[]): string {
  const labels = FIELD_LABELS[kind];
  const keys = (only ?? Object.keys(labels)).filter((k) => k !== 'body' && k !== 'notes' && data[k] != null && data[k] !== '');
  const parts = keys.map((k) => {
    const v = data[k];
    if (k === 'effects' && Array.isArray(v)) return `${v.length} effect${v.length === 1 ? '' : 's'}`;
    if (k === 'level') return v === 'Cantrip' ? 'Cantrip' : `Level ${v}`;
    if (k === 'weight') return `${v} lb`;
    if (k === 'source') return String(v).toUpperCase();
    return String(v);
  });
  return parts.slice(0, 5).join(' · ');
}

// ── Talking to the database ────────────────────────────────────────────────

/** Sharing is on unless the player turned it off on the account page. */
export function sharing(row: ProfileRow | null | undefined): boolean {
  return Boolean(row) && row?.share_rows !== false;
}

const cache = new Map<string, { at: number; hits: Suggestion[] }>();
const FRESH_MS = 60_000;

/** Entries for what is being typed; nothing for under two letters. */
export async function searchLibrary(kind: LibraryKind, query: string): Promise<Suggestion[]> {
  const q = query.trim().replace(/\s+/g, ' ').toLowerCase();
  if (q.length < 2) return [];
  const key = `${kind}\u0000${q}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.hits;
  const { data, error } = await supabase.rpc('search_shared_rows', { p_kind: kind, p_query: q, p_limit: 12 });
  if (error) return [];
  const hits = ((data ?? []) as Suggestion[]).map((s) => ({ ...s, data: s.data ?? {} }));
  cache.set(key, { at: Date.now(), hits });
  return hits;
}

const STAMP = 'dndcompanion:library:';

/** A short fingerprint of what a sheet shares, so the same rows aren't sent twice. */
function stampOf(rows: LibraryRow[]): string {
  const text = JSON.stringify(rows);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `${rows.length}:${(h >>> 0).toString(36)}`;
}

/**
 * Share a sheet's rows (its owner only). Skipped when nothing changed since
 * the last time from this browser, or when sharing is off.
 */
export async function shareSheet(sheetId: string, rows: LibraryRow[]): Promise<void> {
  if (!sharing(get(profile))) return;
  const stamp = stampOf(rows);
  try {
    if (localStorage.getItem(STAMP + sheetId) === stamp) return;
  } catch {
    /* no storage: share anyway */
  }
  const { error } = await supabase.rpc('sync_shared_rows', { p_character: sheetId, p_rows: rows });
  if (error) return;
  cache.clear();
  try {
    localStorage.setItem(STAMP + sheetId, stamp);
  } catch {
    /* fine */
  }
}

/** Forget what this browser shared, so turning sharing back on shares again. */
function clearStamps() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(STAMP)) localStorage.removeItem(k);
  } catch {
    /* fine */
  }
}

/**
 * Turn sharing on or off. Off takes back everything already shared and the
 * player's name from the entries they wrote first.
 */
export async function setSharing(on: boolean): Promise<{ ok: boolean; message?: string }> {
  try {
    await saveProfile({ share_rows: on });
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
  clearStamps();
  cache.clear();
  if (!on) {
    const { error: forgetError } = await supabase.rpc('forget_shared_rows');
    if (forgetError) return { ok: false, message: forgetError.message };
  }
  return { ok: true };
}
