/**
 * Monsters and NPCs a campaign's DM keeps (database/0017, campaign_creatures).
 * Only the DM can read or change them; the database enforces it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import type { CreatureKind } from '$lib/rules/creatures';
import type { StatBlock } from '$lib/rules/statblock';
import type { ConditionLook } from '$lib/types';

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
  /** The colours of the DM's own conditions on it (the standard ones keep theirs), by lookKey. */
  condition_looks: Record<string, ConditionLook>;
  created_at: string;
  updated_at: string;
};
export type CreatureFields = Partial<
  Pick<Creature, 'kind' | 'name' | 'hp_max' | 'hp_current' | 'hp_temp' | 'ac' | 'conditions' | 'notes' | 'link' | 'position' | 'initiative' | 'visible' | 'statblock' | 'portrait' | 'condition_looks'>
>;

const COLUMNS =
  'id, campaign_id, kind, name, hp_max, hp_current, hp_temp, ac, conditions, notes, link, position, initiative, visible, statblock, portrait, condition_looks, created_at, updated_at';

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
};

/*
 * Until database/0020 has run there are no portrait or condition_looks
 * columns: they are read without, and left out of what is saved. TODO: drop
 * once 0020 has run.
 */
const BEFORE_0020 = COLUMNS.replace(', portrait, condition_looks', '');
const missingColumn = (e: { code?: string; message?: string }) => e.code === '42703' || /column .* does not exist/i.test(e.message ?? '');
const filled = (rows: unknown[]) => (rows as Partial<Creature>[]).map((r) => ({ portrait: '', condition_looks: {}, ...r }) as Creature);

const fail = (e: { message?: string }) => new Error(e.message || 'Something went wrong');

export function makeCreatureRepo(client: SupabaseClient) {
  let before0020 = false;
  const columns = () => (before0020 ? BEFORE_0020 : COLUMNS);
  const strip = <T extends Record<string, unknown>>(r: T): T => {
    if (!before0020) return r;
    const { portrait: _p, condition_looks: _c, ...rest } = r as Record<string, unknown>;
    return rest as T;
  };
  return {
    /** The database still waits on 0020 (no portraits or condition colours yet). */
    get before0020() {
      return before0020;
    },
    async list(campaignId: string): Promise<Creature[]> {
      const read = () => client.from('campaign_creatures').select(columns()).eq('campaign_id', campaignId).order('position').order('created_at');
      let { data, error } = await read();
      if (error && !before0020 && missingColumn(error)) {
        before0020 = true;
        ({ data, error } = await read());
      }
      if (error) throw fail(error);
      return filled(data ?? []);
    },
    async add(campaignId: string, rows: CreatureFields[]): Promise<Creature[]> {
      const { data, error } = await client.from('campaign_creatures')
        .insert(rows.map((r) => ({ ...strip(r), campaign_id: campaignId }))).select(columns());
      if (error) throw fail(error);
      return filled(data ?? []);
    },
    async update(id: string, patch: CreatureFields): Promise<void> {
      const fields = strip(patch);
      if (!Object.keys(fields).length) return;
      const { error } = await client.from('campaign_creatures').update(fields).eq('id', id);
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
        const cols = () => `id, kind, name, statblock, ${before0020 ? '' : 'portrait, '}updated_at`;
        let { data, error } = await client.from('homebrew_creatures').select(cols()).order('name');
        if (error && !before0020 && missingColumn(error)) {
          before0020 = true;
          ({ data, error } = await client.from('homebrew_creatures').select(cols()).order('name'));
        }
        if (error) throw fail(error);
        return ((data ?? []) as Partial<Homebrew>[]).map((h) => ({ portrait: '', ...h }) as Homebrew);
      },
      async save(row: { id?: string; kind: CreatureKind; name: string; statblock: StatBlock; portrait?: string }): Promise<Homebrew> {
        const fields = { kind: row.kind, name: row.name, statblock: row.statblock, ...(before0020 ? {} : { portrait: row.portrait ?? '' }) };
        const q = row.id
          ? client.from('homebrew_creatures').update(fields).eq('id', row.id)
          : client.from('homebrew_creatures').insert(fields);
        const { data, error } = await q.select(`id, kind, name, statblock, ${before0020 ? '' : 'portrait, '}updated_at`).single();
        if (error) throw fail(error);
        return { portrait: '', ...(data as Partial<Homebrew>) } as Homebrew;
      },
      async remove(id: string): Promise<void> {
        const { error } = await client.from('homebrew_creatures').delete().eq('id', id);
        if (error) throw fail(error);
      }
    }
  };
}

export const creatureRepo = makeCreatureRepo(supabase);
