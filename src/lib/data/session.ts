import { supabase, supabaseKey, supabaseUrl } from '$lib/supabase';

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

/**
 * Signing in with another service (Google, Discord): sign in (or sign up)
 * with it, or connect it to the account already signed in. Both leave for the
 * service and come back to `next` on this site. Each works once it is
 * switched on in the Supabase dashboard (Authentication → Providers), and
 * connecting needs "Allow manual linking" on as well.
 */
export type OAuthProvider = 'google' | 'discord';
export const PROVIDER_NAMES: Record<OAuthProvider, string> = { google: 'Google', discord: 'Discord' };

export async function signInWithProvider(provider: OAuthProvider, redirectTo: string) {
  const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw new Error(providerMessage(provider, error.message));
}
export async function linkProvider(provider: OAuthProvider, redirectTo: string) {
  const { error } = await supabase.auth.linkIdentity({ provider, options: { redirectTo } });
  if (error) throw new Error(providerMessage(provider, error.message));
}
/** Takes a service off the account; the last way in can't be taken off. */
export async function unlinkProvider(provider: OAuthProvider) {
  const { data, error } = await supabase.auth.getUserIdentities();
  if (error) throw new Error(error.message);
  const all = data?.identities ?? [];
  if (all.length < 2) throw new Error('That’s your only way in! Connect another before taking this one off.');
  const one = all.find((i) => i.provider === provider);
  if (!one) return;
  await unwrap(supabase.auth.unlinkIdentity(one));
  await supabase.auth.refreshSession();
}
export const signInWithGoogle = (redirectTo: string) => signInWithProvider('google', redirectTo);
export const linkGoogle = (redirectTo: string) => linkProvider('google', redirectTo);

let enabled: Promise<Partial<Record<string, boolean>>> | null = null;
/**
 * Which services are switched on in Supabase, so a button is offered only for
 * one that works. Asked once per visit; nothing when it can't be asked.
 */
export function enabledProviders(): Promise<Partial<Record<string, boolean>>> {
  enabled ??= fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j: { external?: Record<string, boolean> }) => j.external ?? {})
    .catch(() => ({}));
  return enabled;
}

/** The sign-in services this account can use ("email", "google", "discord"). */
export function providersOf(user: { identities?: { provider: string }[]; app_metadata?: { providers?: string[] } } | null | undefined): string[] {
  const from = user?.identities?.map((i) => i.provider) ?? user?.app_metadata?.providers ?? [];
  return [...new Set(from)];
}
function providerMessage(provider: OAuthProvider, m: string): string {
  const name = PROVIDER_NAMES[provider];
  if (/not enabled|unsupported provider/i.test(m)) return `${name} sign-in isn’t switched on yet! It needs turning on in Supabase first.`;
  if (/manual linking/i.test(m)) return `Connecting ${name} isn’t switched on yet! Allow manual linking in Supabase first.`;
  if (/already.*linked|identity.*exists/i.test(m)) return `That ${name} account already belongs to another player!`;
  return m;
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
    // A Google account brings its own name and picture; one typed here wins.
    displayName:
      typeof meta.display_name === 'string' && meta.display_name
        ? meta.display_name
        : typeof meta.full_name === 'string' ? meta.full_name : typeof meta.name === 'string' ? meta.name : '',
    // The picture chosen here is kept under its own name: Google writes
    // avatar_url and picture afresh at every sign-in, which undid a picture
    // typed here and brought Google's back when the box was emptied. Empty
    // here means none, on purpose.
    avatarUrl:
      typeof meta.profile_picture === 'string'
        ? meta.profile_picture
        : typeof meta.avatar_url === 'string' && meta.avatar_url ? meta.avatar_url : typeof meta.picture === 'string' ? meta.picture : ''
  };
}

/** Saves the name, the picture, or both (empty is a choice too: no picture). */
export async function updateProfile(profile: Partial<Profile>) {
  const data: Record<string, string> = {};
  if (profile.displayName !== undefined) data.display_name = profile.displayName.trim();
  if (profile.avatarUrl !== undefined) data.profile_picture = profile.avatarUrl.trim();
  await unwrap(supabase.auth.updateUser({ data }));
}

/**
 * Private sheets (database/0014): when on, every sheet of the account can be
 * opened only by its owner and the DM of its campaign. Kept on the account,
 * like the library's sharing, so it covers new sheets too.
 */
export function sheetsPrivate(user: { user_metadata?: Record<string, unknown> } | null | undefined): boolean {
  return user?.user_metadata?.sheets_private === true;
}
export async function setSheetsPrivate(on: boolean) {
  await unwrap(supabase.auth.updateUser({ data: { sheets_private: on } }));
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

/** The campaigns this player is in (as a player) pinned to the top, in their order. */
export function pinnedJoinedOf(user: { user_metadata?: Record<string, unknown> } | null | undefined): string[] {
  const raw = user?.user_metadata?.pinned_joined;
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : [];
}

export async function savePinnedJoined(ids: string[]) {
  await unwrap(supabase.auth.updateUser({ data: { pinned_joined: [...new Set(ids)] } }));
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
