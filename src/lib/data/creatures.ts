/**
 * Monsters and NPCs a campaign's DM keeps (database/0017, campaign_creatures).
 * Only the DM can read or change them; the database enforces it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import type { CreatureKind } from '$lib/rules/creatures';

export type Creature = {
  id: string;
  campaign_id: string;
  kind: CreatureKind;
  name: string;
  hp_max: number | null;
  hp_current: number | null;
  hp_temp: number;
  ac: number | null;
  conditions: string[];
  notes: string;
  link: string;
  position: number;
  created_at: string;
  updated_at: string;
};
export type CreatureFields = Partial<Pick<Creature, 'kind' | 'name' | 'hp_max' | 'hp_current' | 'hp_temp' | 'ac' | 'conditions' | 'notes' | 'link' | 'position'>>;

const COLUMNS = 'id, campaign_id, kind, name, hp_max, hp_current, hp_temp, ac, conditions, notes, link, position, created_at, updated_at';

/** The database hasn't had 0017 yet: the table isn't there. */
export class CreaturesMissing extends Error {
  constructor() {
    super('Monsters and NPCs need a one-time database update');
    this.name = 'CreaturesMissing';
  }
}
const missing = (e: { code?: string; message?: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || (/campaign_creatures/.test(e.message ?? '') && /exist|schema cache/i.test(e.message ?? ''));
const fail = (e: { code?: string; message?: string }) => (missing(e) ? new CreaturesMissing() : new Error(e.message || 'Something went wrong'));

export function makeCreatureRepo(client: SupabaseClient) {
  return {
    async list(campaignId: string): Promise<Creature[]> {
      const { data, error } = await client.from('campaign_creatures').select(COLUMNS).eq('campaign_id', campaignId)
        .order('position').order('created_at');
      if (error) throw fail(error);
      return (data ?? []) as Creature[];
    },
    async add(campaignId: string, rows: CreatureFields[]): Promise<Creature[]> {
      const { data, error } = await client.from('campaign_creatures')
        .insert(rows.map((r) => ({ ...r, campaign_id: campaignId }))).select(COLUMNS);
      if (error) throw fail(error);
      return (data ?? []) as Creature[];
    },
    async update(id: string, patch: CreatureFields): Promise<void> {
      const { error } = await client.from('campaign_creatures').update(patch).eq('id', id);
      if (error) throw fail(error);
    },
    async remove(id: string): Promise<void> {
      const { error } = await client.from('campaign_creatures').delete().eq('id', id);
      if (error) throw fail(error);
    }
  };
}

export const creatureRepo = makeCreatureRepo(supabase);
