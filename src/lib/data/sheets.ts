import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import { emptyState, type Definition, type Sheet, type State } from '$lib/types';

/**
 * Raised when a write's `updated_at` guard did not match — the row moved under
 * us, so another tab or device has newer data. The caller must reload rather
 * than overwrite; silently winning here is how a session's work disappears.
 */
export class StaleWriteError extends Error {
  constructor() {
    super('This sheet was changed somewhere else. Reload to get the latest version.');
    this.name = 'StaleWriteError';
  }
}

const COLUMNS = 'id, owner_id, campaign_id, name, retired, definition, state, created_at, updated_at';

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

  return {
    async loadSheet(id: string): Promise<Sheet | null> {
      const { data, error } = await client.from('sheets').select(COLUMNS).eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Sheet | null) ?? null;
    },

    async listMySheets(ownerId: string): Promise<Sheet[]> {
      const { data, error } = await client
        .from('sheets')
        .select(COLUMNS)
        .eq('owner_id', ownerId);
      if (error) throw new Error(error.message);
      return (data ?? []) as Sheet[];
    },

    async createSheet(ownerId: string, name: string, definition: Definition): Promise<Sheet> {
      const { data, error } = await client
        .from('sheets')
        .insert({ owner_id: ownerId, name, definition, state: emptyState() })
        .select(COLUMNS)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as Sheet;
    },

    saveDefinition(id: string, definition: Definition, expectedUpdatedAt: string) {
      return guardedUpdate(id, { definition }, expectedUpdatedAt);
    },

    saveState(id: string, state: State, expectedUpdatedAt: string) {
      return guardedUpdate(id, { state }, expectedUpdatedAt);
    }
  };
}

export const sheetRepo = makeSheetRepo(supabase);
