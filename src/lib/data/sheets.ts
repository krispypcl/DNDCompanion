import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import {
  TEXT_KEYS,
  blankTexts,
  emptyState,
  type Definition,
  type Sheet,
  type SheetTexts,
  type State,
  type TextKey
} from '$lib/types';

/**
 * Raised when a write's `updated_at` guard did not match — the row moved under
 * us, so another tab or device has newer data. The caller must reload rather
 * than overwrite; silently winning here is how a session's work disappears.
 */
export class StaleWriteError extends Error {
  constructor() {
    super('Someone got here first! This sheet was changed somewhere else. Reload to get the latest version.');
    this.name = 'StaleWriteError';
  }
}

const COLUMNS = 'id, owner_id, campaign_id, name, retired, definition, state, created_at, updated_at';

/**
 * Whether an error means the private-text table has not been created yet. The
 * app is deployed before and after the migration that adds it, so this is an
 * ordinary state to be in, not a failure.
 */
export function isMissingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  // 42P01: Postgres, undefined_table. PGRST205: PostgREST, not in its schema cache.
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /sheet_text/.test(error.message ?? '') && /(does not exist|schema cache|not found)/i.test(error.message ?? '');
}

/** The list needs something readable even before a name has been typed. */
export function sheetName(definition: Definition): string {
  return definition?.identity?.name?.trim() || 'Untitled sheet';
}

export function makeSheetRepo(client: SupabaseClient) {
  async function guardedUpdate(
    id: string,
    patch: Record<string, unknown>,
    expectedUpdatedAt: string
  ): Promise<string> {
    const { data, error } = await client
      .from('sheets')
      .update(patch)
      .eq('id', id)
      .eq('updated_at', expectedUpdatedAt)
      .select('updated_at');

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { updated_at: string }[];
    if (rows.length === 0) throw new StaleWriteError();
    return rows[0].updated_at;
  }

  /**
   * Notes and backstory, as this reader is allowed to see them: the database
   * returns a private row only to its owner, so for anyone else it is simply
   * not there, and reads as unwritten. Null means there is no table yet.
   */
  async function loadTexts(sheet: Pick<Sheet, 'id' | 'definition'>): Promise<SheetTexts | null> {
    const { data, error } = await client
      .from('sheet_text')
      .select('field, body, is_public, updated_at')
      .eq('sheet_id', sheet.id);
    if (error) {
      if (isMissingTable(error)) return null;
      throw new Error(error.message);
    }
    const texts = blankTexts();
    // A sheet saved before the table existed still has its writing in the
    // definition; it stays visible until its first save moves it across.
    for (const key of TEXT_KEYS) {
      const legacy = sheet.definition?.[key];
      if (typeof legacy === 'string') texts[key].body = legacy;
    }
    for (const row of (data ?? []) as {
      field: TextKey;
      body: string;
      is_public: boolean;
      updated_at: string;
    }[]) {
      if (!TEXT_KEYS.includes(row.field)) continue;
      texts[row.field] = { body: row.body, isPublic: row.is_public, updatedAt: row.updated_at };
    }
    return texts;
  }

  return {
    loadTexts,

    async loadSheet(id: string): Promise<Sheet | null> {
      const { data, error } = await client.from('sheets').select(COLUMNS).eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      const sheet = (data as Sheet | null) ?? null;
      if (!sheet) return null;
      return { ...sheet, texts: await loadTexts(sheet) };
    },

    /** Is the table there? Asked before an import, which has to choose where text goes. */
    async textsAvailable(): Promise<boolean> {
      const { error } = await client.from('sheet_text').select('field').limit(0);
      if (error && !isMissingTable(error)) throw new Error(error.message);
      return !error;
    },

    /**
     * Writes one writing. The same guard as everywhere else: a first save is an
     * insert and a later one only lands if the row is as this copy last saw
     * it, so a second device's newer text is never overwritten.
     */
    async saveText(
      sheetId: string,
      ownerId: string,
      field: TextKey,
      body: string,
      isPublic: boolean,
      expectedUpdatedAt: string | null
    ): Promise<string> {
      if (expectedUpdatedAt === null) {
        const { data, error } = await client
          .from('sheet_text')
          .insert({ sheet_id: sheetId, owner_id: ownerId, field, body, is_public: isPublic })
          .select('updated_at');
        // 23505: the row appeared since this copy loaded, written elsewhere.
        if (error?.code === '23505') throw new StaleWriteError();
        if (error) throw new Error(error.message);
        const rows = (data ?? []) as { updated_at: string }[];
        if (rows.length === 0) throw new Error('Could not save');
        return rows[0].updated_at;
      }
      const { data, error } = await client
        .from('sheet_text')
        .update({ body, is_public: isPublic })
        .eq('sheet_id', sheetId)
        .eq('field', field)
        .eq('updated_at', expectedUpdatedAt)
        .select('updated_at');
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { updated_at: string }[];
      if (rows.length === 0) throw new StaleWriteError();
      return rows[0].updated_at;
    },

    async listMySheets(ownerId: string): Promise<Sheet[]> {
      const { data, error } = await client
        .from('sheets')
        .select(COLUMNS)
        .eq('owner_id', ownerId);
      if (error) throw new Error(error.message);
      return (data ?? []) as Sheet[];
    },

    async createSheet(
      ownerId: string,
      name: string,
      definition: Definition,
      state: State = emptyState()
    ): Promise<Sheet> {
      const { data, error } = await client
        .from('sheets')
        .insert({ owner_id: ownerId, name, definition, state })
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Sheet;
    },

    saveDefinition(id: string, definition: Definition, expectedUpdatedAt: string) {
      // `name` is a projection of the character's name, written in the same
      // guarded update so the two can never drift. It exists as its own column
      // so the sheet list can be queried without loading every definition.
      return guardedUpdate(id, { definition, name: sheetName(definition) }, expectedUpdatedAt);
    },

    saveState(id: string, state: State, expectedUpdatedAt: string) {
      return guardedUpdate(id, { state }, expectedUpdatedAt);
    },

    /**
     * Permanent. Row-level security restricts this to the owner, so a refusal
     * arrives as a Postgres error and must reach the caller rather than being
     * reported as a success.
     */
    async deleteSheet(id: string): Promise<void> {
      const { error } = await client.from('sheets').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }
  };
}

export const sheetRepo = makeSheetRepo(supabase);
