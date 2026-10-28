import { readable } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';

export type SessionState = { user: User | null; loading: boolean };

/** Current user, kept in step with Supabase's own session. */
export const session = readable<SessionState>({ user: null, loading: true }, (set) => {
  supabase.auth
    .getSession()
    .then(({ data }) => set({ user: data.session?.user ?? null, loading: false }))
    .catch(() => set({ user: null, loading: false }));

  const { data } = supabase.auth.onAuthStateChange((_event, s) => {
    set({ user: s?.user ?? null, loading: false });
  });

  return () => data.subscription.unsubscribe();
});
