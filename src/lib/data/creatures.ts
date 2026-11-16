/**
 * Monsters and NPCs a campaign's DM keeps (database/0017, campaign_creatures).
 * Only the DM can read or change them; the database enforces it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import type { CreatureKind } from '$lib/rules/creatures';
import type { StatBlock } from '$lib/rules/statblock';

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
  created_at: string;
  updated_at: string;
};
export type CreatureFields = Partial<
  Pick<Creature, 'kind' | 'name' | 'hp_max' | 'hp_current' | 'hp_temp' | 'ac' | 'conditions' | 'notes' | 'link' | 'position' | 'initiative' | 'visible' | 'statblock'>
>;

const COLUMNS =
  'id, campaign_id, kind, name, hp_max, hp_current, hp_temp, ac, conditions, notes, link, position, initiative, visible, statblock, created_at, updated_at';

/** A DM's own monster or NPC, kept to add to any campaign. */
export type Homebrew = { id: string; kind: CreatureKind; name: string; statblock: StatBlock; updated_at: string };
/** What a campaign's players see of a creature the DM revealed. */
export type Revealed = {
  id: string;
  name: string;
  kind: CreatureKind;
  vital: 'healthy' | 'bloodied' | 'critical' | 'down' | 'unknown';
  conditions: string[];
  initiative: number | null;
  position: number;
};

const fail = (e: { message?: string }) => new Error(e.message || 'Something went wrong');

/*
 * Until database/0018 has run, the table has no initiative, visible or
 * statblock columns: the list is read without them (and they are left out
 * of what is saved), so the tracker keeps working with its v1 features.
 * TODO: drop once 0018 has run.
 */
const OLD_COLUMNS = 'id, campaign_id, kind, name, hp_max, hp_current, hp_temp, ac, conditions, notes, link, position, created_at, updated_at';
const NEW_FIELDS = ['initiative', 'visible', 'statblock'] as const;
const missingColumn = (e: { code?: string; message?: string }) => e.code === '42703' || /column .* does not exist/i.test(e.message ?? '');
const filled = (rows: unknown[]) =>
  (rows as Partial<Creature>[]).map((r) => ({ initiative: null, visible: false, statblock: {}, ...r }) as Creature);

export function makeCreatureRepo(client: SupabaseClient) {
  let before0018 = false;
  const columns = () => (before0018 ? OLD_COLUMNS : COLUMNS);
  const strip = <T extends CreatureFields>(r: T): T => {
    if (!before0018) return r;
    const copy = { ...r };
    for (const k of NEW_FIELDS) delete copy[k];
    return copy;
  };
  return {
    /** Whether the database still waits on 0018 (the features it brings are hidden). */
    get before0018() {
      return before0018;
    },
    async list(campaignId: string): Promise<Creature[]> {
      const read = () => client.from('campaign_creatures').select(columns()).eq('campaign_id', campaignId).order('position').order('created_at');
      let { data, error } = await read();
      if (error && !before0018 && missingColumn(error)) {
        before0018 = true;
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
      // Before 0018 there is nothing to reveal.
      if (error?.code === 'PGRST202' || error?.code === '42883') return [];
      if (error) throw fail(error);
      return (data ?? []) as Revealed[];
    },
    homebrew: {
      async list(): Promise<Homebrew[]> {
        const { data, error } = await client.from('homebrew_creatures').select('id, kind, name, statblock, updated_at').order('name');
        if (error) throw fail(error);
        return (data ?? []) as Homebrew[];
      },
      async save(row: { id?: string; kind: CreatureKind; name: string; statblock: StatBlock }): Promise<Homebrew> {
        const q = row.id
          ? client.from('homebrew_creatures').update({ kind: row.kind, name: row.name, statblock: row.statblock }).eq('id', row.id)
          : client.from('homebrew_creatures').insert({ kind: row.kind, name: row.name, statblock: row.statblock });
        const { data, error } = await q.select('id, kind, name, statblock, updated_at').single();
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
