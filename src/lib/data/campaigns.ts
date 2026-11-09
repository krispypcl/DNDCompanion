/**
 * Campaigns. Anyone may read a campaign's name (its page is public by link,
 * like a sheet's); only its DM and players may read its invite, and a sheet joins only
 * through that invite. The database enforces all of it (schema.sql, the
 * campaigns section); these are the calls.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import { friendlyError } from '$lib/errors';

/** A song on the DM's list: a YouTube link, and what to call it. */
export type Song = { url: string; name?: string };
/** What a campaign's page shows beyond its name. */
export type CampaignDetails = {
  bannerUrl?: string;
  songs?: Song[];
  theme?: string;
  /** The DM's order for the character cards (sheet ids); the rest follow by name. */
  order?: string[];
};

/**
 * What the DM's music is doing, for everyone's page to follow: which song
 * (its place on the list, and in a playlist if it is one), whether it plays,
 * and where it was at the moment `at` (ms since 1970, the DM's clock).
 */
export type Playback = { index: number; item?: number; url?: string; playing: boolean; t: number; at: number };
/** A campaign's live row (database/0008). */
export type CampaignLive = { playback: Playback | null; invite_rev: number; updated_at?: string };

/**
 * Something on the shared board. Positions are in board units, on an endless
 * page (units are pixels at 100% zoom). A 'page' is a page of the board
 * itself (database/0009): its name and paper.
 */
export type BoardItem = {
  id: string;
  campaign_id: string;
  kind: 'note' | 'text' | 'stroke' | 'page';
  data: BoardData;
  created_by: string | null;
  updated_at: string;
};
export type BoardData = {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  size?: number;
  /** A stroke: flat [x0, y0, x1, y1, ...] in board units. */
  points?: number[];
  z?: number;
  /** Which page it is on: a page item's id; none is the first page. */
  page?: string;
  /** A page's own: its name, its paper, its place among the pages, and
      whether it stands for the first page (which has no row until renamed). */
  name?: string;
  paper?: 'plain' | 'dots' | 'grid' | 'lines';
  order?: number;
  main?: boolean;
};

export type Campaign = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  archived: boolean;
  details: CampaignDetails;
};

const COLUMNS = 'id, name, created_by, created_at, archived, details';
const asCampaign = (row: Omit<Campaign, 'details'> & { details?: CampaignDetails | null }): Campaign => ({
  ...row,
  details: row.details && typeof row.details === 'object' ? row.details : {}
});

/** A refusal already worded for the player, shown as it is. */
export class CampaignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignError';
  }
}

/** What to tell the player about a failed campaign call. */
export function campaignMessage(error: unknown, fallback: string): string {
  return error instanceof CampaignError ? error.message : friendlyError(error, fallback);
}

/** The friendly words for what the database said no to. */
function refusal(error: { code?: string; message?: string }): Error {
  const m = error.message ?? '';
  if (/campaign has ended/i.test(m)) return new CampaignError('That campaign’s story is already told! Ask your DM if it’s coming back.');
  if (/no campaign has that invite/i.test(m)) return new CampaignError('That invite doesn’t open any door! Check the link, or ask your DM for a fresh one.');
  if (/not yours/i.test(m)) return new CampaignError('That sheet isn’t yours to bring along!');
  if (/needs a name/i.test(m)) return new CampaignError('Every campaign needs a name, even a working title!');
  if (/only the dm/i.test(m)) return new CampaignError('Only the DM can do that!');
  return new Error(m || 'Something went wrong');
}

/** The code from an invite, whether pasted as the code or as the whole link. */
export function inviteCode(text: string): string {
  const raw = text.trim();
  const fromLink = raw.match(/[?&]code=([A-Za-z0-9]+)/);
  return (fromLink ? fromLink[1] : raw).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function makeCampaignRepo(client: SupabaseClient) {
  return {
    async get(id: string): Promise<Campaign | null> {
      const { data, error } = await client.from('campaigns').select(COLUMNS).eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? asCampaign(data as Campaign) : null;
    },

    /** Names for the campaigns a list of sheets is in. */
    async names(ids: string[]): Promise<Map<string, string>> {
      const unique = [...new Set(ids.filter(Boolean))];
      if (unique.length === 0) return new Map();
      const { data, error } = await client.from('campaigns').select('id, name').in('id', unique);
      if (error) throw new Error(error.message);
      return new Map(((data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
    },

    /** The campaigns this player runs. */
    async mine(userId: string): Promise<Campaign[]> {
      const { data, error } = await client.from('campaigns').select(COLUMNS).eq('created_by', userId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      return ((data ?? []) as Campaign[]).map(asCampaign);
    },

    /** A new campaign run by the caller, with one of their sheets in it if given. */
    async create(name: string, sheetId: string | null = null): Promise<{ id: string; invite: string; sheetUpdatedAt: string | null }> {
      const { data, error } = await client.rpc('create_campaign', { p_name: name, p_sheet: sheetId });
      if (error) throw refusal(error);
      const row = (data as { id: string; invite_code: string; sheet_updated_at: string | null }[])[0];
      return { id: row.id, invite: row.invite_code, sheetUpdatedAt: row.sheet_updated_at };
    },

    /** The invite, for its DM; null for anyone else. */
    async invite(campaignId: string): Promise<string | null> {
      const { data, error } = await client.rpc('campaign_invite', { p_campaign: campaignId });
      if (error) throw refusal(error);
      return (data as string | null) ?? null;
    },

    async resetInvite(campaignId: string): Promise<string> {
      const { data, error } = await client.rpc('reset_campaign_invite', { p_campaign: campaignId });
      if (error) throw refusal(error);
      return data as string;
    },

    /** What an invite is for, to name it before joining; null if it is for nothing. */
    async byInvite(code: string): Promise<{ id: string; name: string } | null> {
      const { data, error } = await client.rpc('campaign_by_invite', { p_code: code });
      if (error) throw refusal(error);
      return ((data as { id: string; name: string }[] | null) ?? [])[0] ?? null;
    },

    async join(code: string, sheetId: string): Promise<{ campaignId: string; sheetUpdatedAt: string }> {
      const { data, error } = await client.rpc('join_campaign', { p_code: code, p_sheet: sheetId });
      if (error) throw refusal(error);
      const row = (data as { campaign_id: string; sheet_updated_at: string }[])[0];
      return { campaignId: row.campaign_id, sheetUpdatedAt: row.sheet_updated_at };
    },

    /** The DM takes a sheet out of their campaign. */
    async remove(sheetId: string): Promise<void> {
      const { error } = await client.rpc('remove_from_campaign', { p_sheet: sheetId });
      if (error) throw refusal(error);
    },

    async rename(id: string, name: string): Promise<void> {
      const { error } = await client.from('campaigns').update({ name }).eq('id', id);
      if (error) throw new Error(error.message);
    },

    /** Ended (archived) or reopened; only its DM can. */
    async archive(id: string, archived: boolean): Promise<void> {
      const { data, error } = await client.from('campaigns').update({ archived }).eq('id', id).select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new CampaignError('Only the DM can do that!');
    },

    /** The banner and songs, all at once; only its DM can. */
    async saveDetails(id: string, details: CampaignDetails): Promise<void> {
      const { data, error } = await client.from('campaigns').update({ details }).eq('id', id).select('id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new CampaignError('Only the DM can do that!');
    },

    /** The DM sets a player's conditions (only those). */
    async setConditions(sheetId: string, conditions: string[]): Promise<string> {
      const { data, error } = await client.rpc('set_sheet_conditions', { p_sheet: sheetId, p_conditions: conditions });
      if (error) throw refusal(error);
      return data as string;
    },

    /** What is happening right now; null if it can't be read. */
    async live(campaignId: string): Promise<CampaignLive | null> {
      const { data, error } = await client.from('campaign_live').select('playback, invite_rev, updated_at').eq('campaign_id', campaignId).maybeSingle();
      if (error) return null;
      if (!data) return null;
      const pb = data.playback as Playback | Record<string, never>;
      return { playback: pb && 'index' in pb ? (pb as Playback) : null, invite_rev: data.invite_rev as number, updated_at: data.updated_at as string };
    },

    /** The DM's music, for everyone to follow. */
    async savePlayback(campaignId: string, playback: Playback | null): Promise<void> {
      const { error } = await client.from('campaign_live').update({ playback: playback ?? {} }).eq('campaign_id', campaignId);
      if (error) throw new Error(error.message);
    },

    async board(campaignId: string): Promise<BoardItem[] | null> {
      const { data, error } = await client.from('campaign_board')
        .select('id, campaign_id, kind, data, created_by, updated_at').eq('campaign_id', campaignId)
        .order('created_at', { ascending: true });
      if (error) return null;
      return (data ?? []) as BoardItem[];
    },

    /** The database names it (the insert grant leaves `id` out on purpose). */
    async addToBoard(campaignId: string, userId: string, kind: BoardItem['kind'], data: BoardData): Promise<BoardItem> {
      const { data: row, error } = await client.from('campaign_board')
        .insert({ campaign_id: campaignId, created_by: userId, kind, data })
        .select('id, campaign_id, kind, data, created_by, updated_at').single();
      if (error && /board is full/i.test(error.message)) throw new CampaignError('The board is full! Clear a few things away first.');
      if (error) throw new Error(error.message);
      return row as BoardItem;
    },

    async updateBoard(id: string, data: BoardData): Promise<void> {
      const { error } = await client.from('campaign_board').update({ data }).eq('id', id);
      if (error) throw new Error(error.message);
    },

    async removeFromBoard(ids: string[]): Promise<void> {
      if (!ids.length) return;
      const { error } = await client.from('campaign_board').delete().in('id', ids);
      if (error) throw new Error(error.message);
    },

    /** Gone for good; its sheets stay, out of any campaign. */
    async delete(id: string): Promise<void> {
      const { error } = await client.from('campaigns').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }
  };
}

export const campaignRepo = makeCampaignRepo(supabase);
