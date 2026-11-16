/**
 * Who has a campaign's page open, for the main menu's campaign cards: the
 * same Realtime presence the campaign page joins (TableMusic, channel
 * table-<id>), only listened to. The menu does not count as being there.
 */
import { supabase, isConfigured } from '$lib/supabase';

export type Here = { dm: boolean; users: string[] };

/** Calls back with who is there whenever it changes; returns the way to stop. */
export function watchTable(campaignId: string, on: (here: Here) => void): () => void {
  if (!isConfigured) return () => {};
  const key = `watch-${Math.random().toString(36).slice(2)}`;
  const channel = supabase
    .channel(`table-${campaignId}`, { config: { presence: { key } } })
    .on('presence', { event: 'sync' }, () => {
      const all = Object.values(channel.presenceState() as Record<string, { dm?: boolean; user?: string }[]>).flat();
      on({ dm: all.some((p) => p.dm), users: [...new Set(all.map((p) => p.user).filter((u): u is string => Boolean(u)))] });
    })
    .subscribe();
  return () => void supabase.removeChannel(channel);
}
