/**
 * Campaigns. Anyone may read a campaign's name (its page is public by link,
 * like a sheet's); only its DM may read its invite, and a sheet joins only
 * through that invite. The database enforces all of it (schema.sql, the
 * campaigns section); these are the calls.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import { friendlyError } from '$lib/errors';

export type Campaign = { id: string; name: string; created_by: string; created_at: string };

const COLUMNS = 'id, name, created_by, created_at';

/** A refusal already worded for the player, shown as it is. */
export class CampaignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignError';
  }
}

/** The database has not been given campaigns yet (migration 0004 not run). */
export class CampaignsMissing extends CampaignError {
  constructor() {
    super('Campaigns aren’t set up yet! The database needs its campaign update first.');
    this.name = 'CampaignsMissing';
  }
}

/** What to tell the player about a failed campaign call. */
export function campaignMessage(error: unknown, fallback: string): string {
  return error instanceof CampaignError ? error.message : friendlyError(error, fallback);
}

export function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  // PGRST202: PostgREST, no such function in its schema cache. 42883: Postgres, undefined function.
  return error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(error.message ?? '');
}

/** The friendly words for what the database said no to. */
function refusal(error: { code?: string; message?: string }): Error {
  if (isMissingFunction(error)) return new CampaignsMissing();
  const m = error.message ?? '';
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
      return (data as Campaign | null) ?? null;
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
      return (data ?? []) as Campaign[];
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

    /** Gone for good; its sheets stay, out of any campaign. */
    async delete(id: string): Promise<void> {
      const { error } = await client.from('campaigns').delete().eq('id', id);
      if (error) throw new Error(error.message);
    }
  };
}

export const campaignRepo = makeCampaignRepo(supabase);
