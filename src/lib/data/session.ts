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
