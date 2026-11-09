/**
 * Changing a character's hit points from the map: damage, healing or
 * temporary hit points, worked out the way the sheet's own buttons do it
 * (temporary hit points soak damage first; dropping to 0 knocks them down)
 * and saved through set_sheet_hp (database/0011), which lets the player or
 * their DM do it. Before that migration is run, a player can still change
 * their own.
 */
import { supabase } from '$lib/supabase';
import { applyDamage, applyHealing, setTempHp, withVitals } from '$lib/rules/hp';
import type { Sheet, State } from '$lib/types';
import { emptyState } from '$lib/types';

export type HpChange = 'damage' | 'heal' | 'temp';

export function changed(state: State, hpMax: number, how: HpChange, amount: number): State {
  const n = Math.max(0, Math.floor(amount));
  const next = how === 'damage' ? applyDamage(state, n, hpMax) : how === 'heal' ? applyHealing(state, n, hpMax) : setTempHp(state, n);
  return withVitals(state, next, hpMax);
}

const missing = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === 'PGRST202' || /set_sheet_hp/.test(e.message ?? '')) && /(find|exist|schema cache)/i.test(e.message ?? ''));

export async function changeHp(sheetId: string, how: HpChange, amount: number): Promise<Sheet> {
  const { data: who } = await supabase.auth.getUser();
  if (!who.user) throw new Error('Sign in from the DND Companion panel first, then try again!');
  const { data, error } = await supabase.from('sheets').select('id, owner_id, campaign_id, name, retired, definition, state, created_at, updated_at').eq('id', sheetId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('That character has wandered off! The sheet isn’t there any more.');
  const sheet = data as Sheet;
  const state: State = { ...emptyState(), ...(sheet.state ?? {}) };
  const max = Number(sheet.definition?.combat?.hpMax) || 0;
  const next = changed(state, max, how, amount);
  const rpc = await supabase.rpc('set_sheet_hp', {
    p_sheet: sheetId,
    p_current: Math.max(0, Math.round(next.hpCurrent)),
    p_temp: Math.max(0, Math.round(next.hpTemp ?? 0)),
    p_conditions: next.conditions ?? [],
    p_death_saves: next.deathSaves ?? { successes: 0, failures: 0 }
  });
  if (!rpc.error) return { ...sheet, state: next };
  if (missing(rpc.error) && sheet.owner_id === who.user.id) {
    // The migration is not in yet: the player changes their own sheet.
    const up = await supabase.from('sheets').update({ state: next }).eq('id', sheetId).eq('updated_at', sheet.updated_at).select('id');
    if (up.error) throw new Error(up.error.message);
    if (!up.data?.length) throw new Error('Someone got there first! Try that again.');
    return { ...sheet, state: next };
  }
  if (missing(rpc.error)) throw new Error('The DM’s map can’t change hit points until the database is updated (migration 0011)!');
  if (/only the player or the dm/i.test(rpc.error.message)) throw new Error('Only the player or their DM can change those hit points!');
  throw new Error(rpc.error.message);
}
