/**
 * The signed-in player's profile (database: profiles): their name and
 * picture, privacy, preferences and pinned lists. Loaded when they sign in,
 * changed here first and then saved, so the page answers at once.
 */
import { get, writable } from 'svelte/store';
import { supabase } from '$lib/supabase';
import { session } from '$lib/stores/session';

export type ProfileRow = {
  id: string;
  display_name: string;
  /** Empty: no picture, on purpose. Null: the one Google or Discord brings. */
  picture_url: string | null;
  share_rows: boolean;
  private_sheets: boolean;
  preferences: Record<string, unknown>;
  pinned_characters: string[];
  pinned_campaigns: string[];
  pinned_joined_campaigns: string[];
};

export const profile = writable<ProfileRow | null>(null);

let loadedFor: string | null = null;

async function load(id: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if (loadedFor !== id) return;
  if (data) {
    profile.set(data as ProfileRow);
    return;
  }
  if (error) return;
  // Made with the account normally; a row missing for any reason is made now.
  const made = await supabase.from('profiles').insert({ id }).select('*').maybeSingle();
  if (loadedFor === id && made.data) profile.set(made.data as ProfileRow);
}

if (typeof window !== 'undefined') {
  session.subscribe((s) => {
    const id = s.user?.id ?? null;
    if (id === loadedFor) return;
    loadedFor = id;
    profile.set(null);
    if (id) void load(id).catch(() => {});
  });
}

/** Changes the profile here at once, then saves it; put back if the save fails. */
export async function saveProfile(patch: Partial<Omit<ProfileRow, 'id'>>) {
  const before = get(profile);
  if (!before) throw new Error('Your profile is still loading! Try again in a moment.');
  profile.set({ ...before, ...patch });
  const { error } = await supabase.from('profiles').update(patch).eq('id', before.id);
  if (error) {
    profile.update((now) => (now && now.id === before.id ? { ...now, ...Object.fromEntries(Object.keys(patch).map((k) => [k, before[k as keyof ProfileRow]])) } : now));
    throw new Error(error.message);
  }
}

/** Merges into the preferences (look, dice, motion, music) and saves. */
export async function savePreferences(patch: Record<string, unknown>) {
  const now = get(profile);
  await saveProfile({ preferences: { ...(now?.preferences ?? {}), ...patch } });
}
