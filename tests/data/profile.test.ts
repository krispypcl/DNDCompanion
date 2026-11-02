import { describe, expect, it, vi } from 'vitest';

const updateUser = vi.fn(async () => ({ data: {}, error: null }));
const signOut = vi.fn(async () => ({ error: null }));
const rpc = vi.fn(async () => ({ error: null as null | { code?: string; message: string } }));
vi.mock('$lib/supabase', () => ({ supabase: { auth: { updateUser, signOut }, rpc } }));

const { profileOf, updateProfile, signOutEverywhere } = await import('$lib/data/session');

describe('profile', () => {
  it('reads the name and picture from the account, and nothing when unset', () => {
    expect(profileOf({ user_metadata: { display_name: 'Chris', avatar_url: 'https://i.imgur.com/x.png' } }))
      .toEqual({ displayName: 'Chris', avatarUrl: 'https://i.imgur.com/x.png' });
    expect(profileOf({ user_metadata: { display_name: 7 } })).toEqual({ displayName: '', avatarUrl: '' });
    expect(profileOf(null)).toEqual({ displayName: '', avatarUrl: '' });
  });

  it('saves both, trimmed', async () => {
    await updateProfile({ displayName: '  Chris ', avatarUrl: ' https://x/y.png ' });
    expect(updateUser).toHaveBeenCalledWith({ data: { display_name: 'Chris', avatar_url: 'https://x/y.png' } });
  });

  it('signs out of every device', async () => {
    await signOutEverywhere();
    expect(signOut).toHaveBeenCalledWith({ scope: 'global' });
  });
});

describe('pinned sheets', () => {
  it('reads the pinned list from the account, in order, ignoring junk', async () => {
    const { pinnedOf } = await import('$lib/data/session');
    expect(pinnedOf({ user_metadata: { pinned_sheets: ['b', 'a', 3, null] } })).toEqual(['b', 'a']);
    expect(pinnedOf({ user_metadata: {} })).toEqual([]);
    expect(pinnedOf(null)).toEqual([]);
  });
  it('saves without duplicates', async () => {
    const { savePinned } = await import('$lib/data/session');
    await savePinned(['a', 'b', 'a']);
    expect(updateUser).toHaveBeenLastCalledWith({ data: { pinned_sheets: ['a', 'b'] } });
  });
});

describe('deleteAccount', () => {
  it('calls the database function and signs out', async () => {
    const { deleteAccount } = await import('$lib/data/session');
    await deleteAccount();
    expect(rpc).toHaveBeenCalledWith('delete_own_account');
    expect(signOut).toHaveBeenLastCalledWith({ scope: 'local' });
  });
  it('says so when the database has not been given the function yet', async () => {
    const { deleteAccount, DeleteNotAvailable } = await import('$lib/data/session');
    rpc.mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'Could not find the function public.delete_own_account' } });
    await expect(deleteAccount()).rejects.toBeInstanceOf(DeleteNotAvailable);
  });
});
