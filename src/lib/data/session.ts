import { get } from 'svelte/store';
import { supabase, supabaseKey, supabaseUrl } from '$lib/supabase';
import { profile, saveProfile, savePreferences, type ProfileRow } from '$lib/stores/profile';

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

/** Signs this account out on every device, this one included. */
export async function signOutEverywhere() {
  await unwrap(supabase.auth.signOut({ scope: 'global' }));
}

export async function requestReset(email: string, redirectTo?: string) {
  await unwrap(supabase.auth.resetPasswordForEmail(email, { redirectTo }));
}

export async function updatePassword(password: string) {
  await unwrap(supabase.auth.updateUser({ password }));
}

/** What a player shows of themselves: kept on their account, no table needed. */
export type Profile = { displayName: string; avatarUrl: string };

type Meta = { user_metadata?: Record<string, unknown> } | null | undefined;

/**
 * How the player appears: their profile's name and picture (database:
 * profiles), falling back to what their Google or Discord account brought.
 * A picture left empty on purpose stays empty.
 */
export function profileOf(user: Meta, row?: ProfileRow | null): Profile {
  const meta = user?.user_metadata ?? {};
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const brought = str(meta.avatar_url) || str(meta.picture);
  return {
    displayName: row?.display_name || str(meta.display_name) || str(meta.full_name) || str(meta.name),
    avatarUrl: row ? (row.picture_url ?? brought) : brought
  };
}

/** Saves the name, the picture, or both (empty is a choice too: no picture). */
export async function updateProfile(p: Partial<Profile>) {
  const patch: Partial<ProfileRow> = {};
  if (p.displayName !== undefined) patch.display_name = p.displayName.trim().slice(0, 60);
  if (p.avatarUrl !== undefined) patch.picture_url = p.avatarUrl.trim();
  await saveProfile(patch);
}

/**
 * Private sheets (database: profiles.private_sheets): when on, every sheet of
 * the player can be opened only by them and the DM of its campaign.
 */
export function sheetsPrivate(row: ProfileRow | null | undefined): boolean {
  return row?.private_sheets === true;
}
export async function setSheetsPrivate(on: boolean) {
  await saveProfile({ private_sheets: on });
}

const ids = (list: unknown): string[] => (Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);

/** The characters a player has pinned, in their order. */
export function pinnedOf(row: ProfileRow | null | undefined): string[] {
  return ids(row?.pinned_characters);
}
export async function savePinned(list: string[]) {
  await saveProfile({ pinned_characters: [...new Set(list)] });
}

/** Pinned campaigns they run, in their order. */
export function pinnedCampaignsOf(row: ProfileRow | null | undefined): string[] {
  return ids(row?.pinned_campaigns);
}
export async function savePinnedCampaigns(list: string[]) {
  await saveProfile({ pinned_campaigns: [...new Set(list)] });
}

/** Pinned campaigns they play in, in their order. */
export function pinnedJoinedOf(row: ProfileRow | null | undefined): string[] {
  return ids(row?.pinned_joined_campaigns);
}
export async function savePinnedJoined(list: string[]) {
  await saveProfile({ pinned_joined_campaigns: [...new Set(list)] });
}

/** Whether this player wants music shuffled (preferences.musicShuffle). */
export function shuffleOf(row: ProfileRow | null | undefined): boolean | null {
  const raw = row?.preferences?.musicShuffle;
  return typeof raw === 'boolean' ? raw : null;
}
export async function saveShuffle(on: boolean) {
  await savePreferences({ musicShuffle: on });
}

/** Where a music player is: a sheet's, or a campaign's jukebox. Each keeps its own loop. */
export type MusicPlace = 'sheet' | 'campaign';

/** Whether this player wants that music to loop (preferences.musicLoop). */
export function loopOf(row: ProfileRow | null | undefined, place: MusicPlace): boolean | null {
  const loops = row?.preferences?.musicLoop as Record<string, unknown> | undefined;
  const raw = loops?.[place];
  return typeof raw === 'boolean' ? raw : null;
}
export async function saveLoop(place: MusicPlace, on: boolean) {
  const now = get(profile);
  const loops = { ...((now?.preferences?.musicLoop as Record<string, unknown>) ?? {}), [place]: on };
  await savePreferences({ musicLoop: loops });
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
