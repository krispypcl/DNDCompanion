import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const signOut = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async () => ({ error: null as null | { code?: string; message: string } }));
/** What the last profiles update sent, and the answer it gets. */
const update = vi.fn((_patch: unknown) => ({ eq: vi.fn(async () => ({ error: null as null | { message: string } })) }));
const from = vi.fn(() => ({ update }));
vi.mock('$lib/supabase', () => ({ supabase: { auth: { signOut, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: null } }) }, rpc, from } }));

const session = await import('$lib/data/session');
const { profile } = await import('$lib/stores/profile');
import type { ProfileRow } from '$lib/stores/profile';

const row = (over: Partial<ProfileRow> = {}): ProfileRow => ({
  id: 'u1', display_name: '', picture_url: null, share_rows: true, private_sheets: false, preferences: {},
  pinned_characters: [], pinned_campaigns: [], pinned_joined_campaigns: [], ...over
});

beforeEach(() => {
  profile.set(row());
  update.mockClear();
});

describe('profile', () => {
  it('takes the name and picture from the profile, else from Google or Discord', () => {
    const google = { user_metadata: { full_name: 'Pat Google', avatar_url: 'https://lh3/g.png' } };
    expect(session.profileOf(google, row())).toEqual({ displayName: 'Pat Google', avatarUrl: 'https://lh3/g.png' });
    expect(session.profileOf(google, row({ display_name: 'Pat', picture_url: 'https://i.imgur.com/me.png' })))
      .toEqual({ displayName: 'Pat', avatarUrl: 'https://i.imgur.com/me.png' });
    // Emptied on purpose: no picture, not Google's.
    expect(session.profileOf(google, row({ picture_url: '' })).avatarUrl).toBe('');
    expect(session.profileOf(null, null)).toEqual({ displayName: '', avatarUrl: '' });
  });

  it('saves the name and picture, trimmed, to the profile', async () => {
    await session.updateProfile({ displayName: '  Chris ', avatarUrl: ' https://x/y.png ' });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenLastCalledWith({ display_name: 'Chris', picture_url: 'https://x/y.png' });
    expect(get(profile)).toMatchObject({ display_name: 'Chris', picture_url: 'https://x/y.png' });
    await session.updateProfile({ displayName: 'Chris' });
    expect(update).toHaveBeenLastCalledWith({ display_name: 'Chris' });
  });

  it('puts the profile back when a save fails', async () => {
    update.mockReturnValueOnce({ eq: vi.fn(async () => ({ error: { message: 'nope' } })) });
    await expect(session.setSheetsPrivate(true)).rejects.toThrow('nope');
    expect(get(profile)?.private_sheets).toBe(false);
  });

  it('keeps sheets private only when switched on', async () => {
    expect(session.sheetsPrivate(row({ private_sheets: true }))).toBe(true);
    expect(session.sheetsPrivate(row())).toBe(false);
    expect(session.sheetsPrivate(null)).toBe(false);
    await session.setSheetsPrivate(true);
    expect(update).toHaveBeenLastCalledWith({ private_sheets: true });
  });

  it('keeps music choices among the preferences', async () => {
    profile.set(row({ preferences: { mode: 'light' } }));
    await session.saveLoop('campaign', true);
    expect(update).toHaveBeenLastCalledWith({ preferences: { mode: 'light', musicLoop: { campaign: true } } });
    expect(session.loopOf(get(profile), 'campaign')).toBe(true);
    expect(session.loopOf(get(profile), 'sheet')).toBeNull();
    await session.saveShuffle(false);
    expect(session.shuffleOf(get(profile))).toBe(false);
  });

  it('signs out of every device', async () => {
    await session.signOutEverywhere();
    expect(signOut).toHaveBeenCalledWith({ scope: 'global' });
  });
});

describe('pinned characters', () => {
  it('reads the pinned list from the profile, in order, ignoring junk', () => {
    expect(session.pinnedOf(row({ pinned_characters: ['b', 'a', 3 as never, null as never] }))).toEqual(['b', 'a']);
    expect(session.pinnedOf(row())).toEqual([]);
    expect(session.pinnedOf(null)).toEqual([]);
  });
  it('saves without duplicates', async () => {
    await session.savePinned(['a', 'b', 'a']);
    expect(update).toHaveBeenLastCalledWith({ pinned_characters: ['a', 'b'] });
  });
});

describe('deleteAccount', () => {
  it('calls the database function and signs out', async () => {
    await session.deleteAccount();
    expect(rpc).toHaveBeenCalledWith('delete_own_account');
    expect(signOut).toHaveBeenLastCalledWith({ scope: 'local' });
  });
  it('says so when it fails', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'boom' } });
    await expect(session.deleteAccount()).rejects.toThrow('boom');
  });
});
