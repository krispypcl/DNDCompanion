/**
 * Monsters and NPCs a campaign's DM keeps (database/0017, campaign_creatures).
 * Only the DM can read or change them; the database enforces it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '#lib/supabase.ts';
import { campaignRepo } from './campaigns.ts';
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
    /**
     * Each change to a campaign's creatures, made anywhere (database/0025;
     * only the DM hears them). An update may leave out a large column it
     * didn't touch (the stat block), so it is merged onto the row held. A
     * delete carries only the id and can't be filtered by campaign, so the
     * caller keeps the ones it has. Returns how to stop.
     */
    watch(campaignId: string, on: { row: (c: Partial<Creature> & { id: string }) => void; gone: (id: string) => void; joined?: () => void }): () => void {
      const filter = `campaign_id=eq.${campaignId}`;
      const row = (payload: { new?: unknown }) => {
        const c = payload.new as Partial<Creature> | undefined;
        if (c?.id) on.row(c as Partial<Creature> & { id: string });
      };
      const channel = client
        .channel(`creatures-${campaignId}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_creatures', filter }, row)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_creatures', filter }, row)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'campaign_creatures' }, (payload) => {
          const id = (payload.old as { id?: string } | undefined)?.id;
          if (id) on.gone(id);
        })
        .subscribe((status) => status === 'SUBSCRIBED' && on.joined?.());
      return () => void client.removeChannel(channel);
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

/**
 * What the players see of the DM's creatures, worked out on the DM's page
 * the way revealed_creatures does it in the database (database/0018, 0023):
 * only the revealed ones, and how hurt they look rather than their numbers.
 */
export function asRevealed(list: Creature[]): Revealed[] {
  return list.filter((c) => c.visible).map((c) => {
    const max = c.hp_max ?? 0;
    const now = c.hp_current ?? max;
    const vital: Revealed['vital'] = max <= 0 ? 'unknown' : now <= 0 ? 'down' : now / max <= 0.25 ? 'critical' : now / max <= 0.5 ? 'bloodied' : 'healthy';
    return {
      id: c.id, name: c.name, kind: c.kind, vital, conditions: c.conditions, initiative: c.initiative, position: c.position,
      portrait: c.portrait, condition_looks: c.condition_looks, expression: c.expression
    };
  });
}

/** In the DM's order: by place, then oldest first. */
export const inOrder = (list: Creature[]): Creature[] =>
  [...list].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));

/** Reads again a moment after the last nudge, on waking, and on (re)joining; returns how to stop. */
function keepReading(read: () => Promise<void>, listen: (nudge: () => void) => () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const nudge = () => {
    clearTimeout(timer);
    timer = setTimeout(() => void read(), 150);
  };
  void read();
  const stop = listen(nudge);
  const wake = () => document.visibilityState === 'visible' && nudge();
  document.addEventListener('visibilitychange', wake);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', wake);
    stop();
  };
}

/** A campaign's creatures, live, for its DM (read-only: the Owlbear room's tokens and menus). Returns how to stop. */
export function followCreatures(campaignId: string, onlist: (list: Creature[]) => void, onerror?: (e: unknown) => void): () => void {
  let stopped = false;
  let list: Creature[] = [];
  const show = (next: Creature[]) => {
    list = next;
    if (!stopped) onlist(next);
  };
  const stop = keepReading(
    () => creatureRepo.list(campaignId).then(show, (e) => void (!stopped && onerror?.(e))),
    (nudge) => creatureRepo.watch(campaignId, {
      row: (c) => (list.some((x) => x.id === c.id) ? show(inOrder(list.map((x) => (x.id === c.id ? { ...x, ...c } : x)))) : nudge()),
      gone: (id) => list.some((x) => x.id === id) && show(list.filter((x) => x.id !== id)),
      joined: nudge
    })
  );
  return () => {
    stopped = true;
    stop();
  };
}

/**
 * What the players see of a campaign's creatures, live: asked again whenever
 * one they can see changes (database/0025 counts those in campaign_state).
 * Returns how to stop.
 */
export function followRevealed(campaignId: string, onlist: (list: Revealed[]) => void): () => void {
  let stopped = false;
  let rev: number | undefined;
  const stop = keepReading(
    () => creatureRepo.revealed(campaignId).then((r) => void (!stopped && onlist(r)), () => {}),
    (nudge) => campaignRepo.followState(campaignId, (row) => {
      if (row.creatures_rev === undefined || row.creatures_rev === rev) return;
      rev = row.creatures_rev;
      nudge();
    }, nudge)
  );
  return () => {
    stopped = true;
    stop();
  };
}
