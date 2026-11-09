/**
 * Rolls travel from a sheet to every Owlbear room it is in over a Supabase
 * Realtime broadcast: one channel per sheet, which the room's extension
 * listens on. Nothing is stored on the way; a room that is not listening
 * simply misses the roll.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isConfigured, supabase } from '$lib/supabase';
import type { Roll } from '$lib/rules/dice';
import { noteOf, readNote, type RollNote } from './rolls';

export const rollChannelName = (sheet: string) => `dndc-rolls:${sheet}`;
const EVENT = 'roll';

const open = new Map<string, RealtimeChannel>();
function channelFor(sheet: string): RealtimeChannel {
  let ch = open.get(sheet);
  if (!ch) {
    ch = supabase.channel(rollChannelName(sheet), { config: { broadcast: { self: false, ack: false } } });
    ch.subscribe();
    open.set(sheet, ch);
  }
  return ch;
}

/** Sends a roll made on a sheet to whichever rooms are listening. */
export function shareRoll(sheet: string, who: string, roll: Roll): void {
  if (!isConfigured || typeof window === 'undefined') return;
  const note = noteOf(roll, sheet, who);
  const ch = channelFor(sheet);
  // Over the open connection when it is up; by a plain request until then.
  const sent = ch.state === 'joined' ? ch.send({ type: 'broadcast', event: EVENT, payload: note }) : ch.httpSend(EVENT, note);
  void Promise.resolve(sent).catch(() => {});
}

/** Listens for rolls on these sheets; returns how to stop. */
export function hearRolls(sheets: string[], onroll: (note: RollNote) => void): () => void {
  if (!isConfigured) return () => {};
  const chans = sheets.map((id) =>
    supabase
      .channel(rollChannelName(id), { config: { broadcast: { self: false } } })
      .on('broadcast', { event: EVENT }, ({ payload }) => {
        const note = readNote(payload);
        if (note && note.sheet === id) onroll(note);
      })
      .subscribe()
  );
  return () => chans.forEach((c) => void supabase.removeChannel(c));
}
