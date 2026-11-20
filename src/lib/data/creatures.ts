/**
 * Monsters and NPCs a campaign's DM keeps (database/0017, campaign_creatures).
 * Only the DM can read or change them; the database enforces it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '#lib/supabase.ts';
import type { CreatureKind } from '#lib/rules/creatures.ts';
import type { StatBlock } from '#lib/rules/statblock.ts';
import type { ConditionLook } from '#lib/types.ts';

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
  /** Its place in the initiative order, once rolled or written (database/0018). */
  initiative: number | null;
  /** Shown to the players (by name, conditions and how hurt it looks). */
  visible: boolean;
  statblock: StatBlock;
  /** A picture link (database/0020): the DM's, or a 5e.tools monster's token art. */
  portrait: string;
  /** The colors of the DM's own conditions on it (the standard ones keep theirs), by lookKey. */
  condition_looks: Record<string, ConditionLook>;
  /** Its expression, for the players (database/0023): "Snarling", "About to flee". */
  expression: string;
  created_at: string;
  updated_at: string;
};
export type CreatureFields = Partial<
  Pick<Creature, 'kind' | 'name' | 'hp_max' | 'hp_current' | 'hp_temp' | 'ac' | 'conditions' | 'notes' | 'link' | 'position' | 'initiative' | 'visible' | 'statblock' | 'portrait' | 'condition_looks' | 'expression'>
>;

const COLUMNS =
  'id, campaign_id, kind, name, hp_max, hp_current, hp_temp, ac, conditions, notes, link, position, initiative, visible, statblock, portrait, condition_looks, expression, created_at, updated_at';

/** A DM's own monster or NPC, kept to add to any campaign. */
export type Homebrew = { id: string; kind: CreatureKind; name: string; statblock: StatBlock; portrait: string; updated_at: string };
/** What a campaign's players see of a creature the DM revealed. */
export type Revealed = {
  id: string;
  name: string;
  kind: CreatureKind;
  vital: 'healthy' | 'bloodied' | 'critical' | 'down' | 'unknown';
  conditions: string[];
  initiative: number | null;
  position: number;
  portrait?: string;
  condition_looks?: Record<string, ConditionLook>;
  /** Its expression, as the DM describes it (database/0023). */
  expression?: string;
};

const HOMEBREW = 'id, kind, name, statblock, portrait, updated_at';

const fail = (e: { message?: string }) => new Error(e.message || 'Something went wrong');

export function makeCreatureRepo(client: SupabaseClient) {
  return {
    async list(campaignId: string): Promise<Creature[]> {
      const { data, error } = await client.from('campaign_creatures').select(COLUMNS).eq('campaign_id', campaignId).order('position').order('created_at');
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
      if (!Object.keys(patch).length) return;
      const { error } = await client.from('campaign_creatures').update(patch).eq('id', id);
      if (error) throw fail(error);
    },
    async remove(id: string): Promise<void> {
      const { error } = await client.from('campaign_creatures').delete().eq('id', id);
      if (error) throw fail(error);
    },
    /** New places for several at once (after a drag): one update each. */
    async reorder(ids: string[]): Promise<void> {
      await Promise.all(ids.map((id, i) => client.from('campaign_creatures').update({ position: i }).eq('id', id).then(({ error }) => {
        if (error) throw fail(error);
      })));
    },
    /** The players' view: only the revealed ones, without their numbers. */
    async revealed(campaignId: string): Promise<Revealed[]> {
      const { data, error } = await client.rpc('revealed_creatures', { p_campaign: campaignId });
      if (error) throw fail(error);
      return (data ?? []) as Revealed[];
    },
    homebrew: {
      async list(): Promise<Homebrew[]> {
        const { data, error } = await client.from('homebrew_creatures').select(HOMEBREW).order('name');
        if (error) throw fail(error);
        return (data ?? []) as Homebrew[];
      },
      async save(row: { id?: string; kind: CreatureKind; name: string; statblock: StatBlock; portrait?: string }): Promise<Homebrew> {
        const fields = { kind: row.kind, name: row.name, statblock: row.statblock, portrait: row.portrait ?? '' };
        const q = row.id
          ? client.from('homebrew_creatures').update(fields).eq('id', row.id)
          : client.from('homebrew_creatures').insert(fields);
        const { data, error } = await q.select(HOMEBREW).single();
        if (error) throw fail(error);
        return data as Homebrew;
      },
      async remove(id: string): Promise<void> {
        const { error } = await client.from('homebrew_creatures').delete().eq('id', id);
        if (error) throw fail(error);
      }
    }
  };
}

export const creatureRepo = makeCreatureRepo(supabase);
