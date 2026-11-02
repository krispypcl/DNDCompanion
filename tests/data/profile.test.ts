import { describe, expect, it, vi } from 'vitest';

const updateUser = vi.fn(async () => ({ data: {}, error: null }));
const signOut = vi.fn(async () => ({ error: null }));
vi.mock('$lib/supabase', () => ({ supabase: { auth: { updateUser, signOut } } }));

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
