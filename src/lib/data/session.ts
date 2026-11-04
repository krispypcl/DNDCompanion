import { supabase } from '$lib/supabase';

/** Thin wrappers over Supabase Auth. Errors are thrown with Supabase's own
 *  message so the UI can show something specific rather than "failed". */

async function unwrap<T extends { error: { message: string } | null }>(promise: Promise<T>) {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  return result;
}

export async function signUp(email: string, password: string, redirectTo?: string) {
  await unwrap(
    supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
  );
}

export async function signIn(email: string, password: string) {
  await unwrap(supabase.auth.signInWithPassword({ email, password }));
}

export async function signOut() {
  await unwrap(supabase.auth.signOut());
}

export async function requestReset(email: string, redirectTo?: string) {
  await unwrap(supabase.auth.resetPasswordForEmail(email, { redirectTo }));
}

export async function updatePassword(password: string) {
  await unwrap(supabase.auth.updateUser({ password }));
}

/** What a player shows of themselves: kept on their account, no table needed. */
export type Profile = { displayName: string; avatarUrl: string };

export function profileOf(user: { user_metadata?: Record<string, unknown> } | null | undefined): Profile {
  const meta = user?.user_metadata ?? {};
  return {
    displayName: typeof meta.display_name === 'string' ? meta.display_name : '',
    avatarUrl: typeof meta.avatar_url === 'string' ? meta.avatar_url : ''
  };
}

export async function updateProfile(profile: Profile) {
  await unwrap(
    supabase.auth.updateUser({
      data: { display_name: profile.displayName.trim(), avatar_url: profile.avatarUrl.trim() }
    })
  );
}

/** Signs this account out on every device, this one included. */
export async function signOutEverywhere() {
  await unwrap(supabase.auth.signOut({ scope: 'global' }));
}

/**
 * The sheets a player has pinned, in the order they put them. Kept on the
 * account itself (Supabase Auth's user metadata), so it follows them to every
 * device and needs nothing new in the database.
 */
export function pinnedOf(user: { user_metadata?: Record<string, unknown> } | null | undefined): string[] {
  const raw = user?.user_metadata?.pinned_sheets;
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

export async function savePinned(ids: string[]) {
  await unwrap(supabase.auth.updateUser({ data: { pinned_sheets: [...new Set(ids)] } }));
}

/** Pinned campaigns, in the player's own order, as for sheets. */
export function pinnedCampaignsOf(user: { user_metadata?: Record<string, unknown> } | null | undefined): string[] {
  const raw = user?.user_metadata?.pinned_campaigns;
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

export async function savePinnedCampaigns(ids: string[]) {
  await unwrap(supabase.auth.updateUser({ data: { pinned_campaigns: [...new Set(ids)] } }));
}

/** Whether this player wants the sheets' music shuffled; kept with their account. */
export function shuffleOf(user: { user_metadata?: Record<string, unknown> } | null | undefined): boolean | null {
  const raw = user?.user_metadata?.music_shuffle;
  return typeof raw === 'boolean' ? raw : null;
}

export async function saveShuffle(on: boolean) {
  await unwrap(supabase.auth.updateUser({ data: { music_shuffle: on } }));
}

/** Where a music player is: a sheet's, or a campaign's jukebox. Each keeps its own loop. */
export type MusicPlace = 'sheet' | 'campaign';
const LOOP_FIELD: Record<MusicPlace, string> = { sheet: 'music_loop', campaign: 'jukebox_loop' };

/** Whether this player wants that music to loop; kept with their account. */
export function loopOf(user: { user_metadata?: Record<string, unknown> } | null | undefined, place: MusicPlace): boolean | null {
  const raw = user?.user_metadata?.[LOOP_FIELD[place]];
  return typeof raw === 'boolean' ? raw : null;
}

export async function saveLoop(place: MusicPlace, on: boolean) {
  await unwrap(supabase.auth.updateUser({ data: { [LOOP_FIELD[place]]: on } }));
}

/**
 * Deletes the signed-in player's account and, by the database's cascades,
 * every sheet and piece of writing they made (delete_own_account in
 * schema.sql).
 */
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw new Error(error.message);
  // The session belonged to an account that no longer exists.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}
