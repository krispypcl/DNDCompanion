/**
 * The characters a room follows, kept current: the sheets linked one by one,
 * and every active character of the linked campaigns. Sheets are readable by
 * anyone with the link, so this works signed in or not. Changes arrive over
 * Supabase Realtime and are followed by a fresh read (debounced), the way the
 * campaign page does it.
 */
import { isConfigured, supabase } from '$lib/supabase';
import { blankDefinition } from '$lib/sample';
import { emptyState, type Sheet } from '$lib/types';

/**
 * A sheet as stored can be missing parts a newer version of the app adds
 * (or be nearly empty, made and never filled in). The room fills the gaps
 * from a blank sheet, so one odd sheet can't stop the others from showing.
 */
export function complete(sheet: Sheet): Sheet {
  const blank = blankDefinition('');
  const def = (sheet.definition ?? {}) as Partial<Sheet['definition']>;
  return {
    ...sheet,
    definition: {
      ...blank,
      ...def,
      identity: { ...blank.identity, ...(def.identity ?? {}) },
      combat: { ...blank.combat, ...(def.combat ?? {}) }
    } as Sheet['definition'],
    state: { ...emptyState(), ...((sheet.state ?? {}) as Partial<Sheet['state']>) }
  };
}

const COLUMNS = 'id, owner_id, campaign_id, name, retired, definition, state, created_at, updated_at';

export type Follow = { sheets: string[]; campaigns: string[] };

export async function readSheets(follow: Follow): Promise<Sheet[]> {
  if (!isConfigured) return [];
  const reads: PromiseLike<{ data: unknown; error: { message: string } | null }>[] = [];
  if (follow.sheets.length) reads.push(supabase.from('sheets').select(COLUMNS).in('id', follow.sheets));
  if (follow.campaigns.length) reads.push(supabase.from('sheets').select(COLUMNS).in('campaign_id', follow.campaigns).eq('retired', false));
  const results = await Promise.all(reads);
  const byId = new Map<string, Sheet>();
  for (const r of results) {
    if (r.error) throw new Error(r.error.message);
    for (const s of (r.data ?? []) as Sheet[]) byId.set(s.id, complete(s));
  }
  // In the order they were linked, then campaign members by name.
  const order = new Map(follow.sheets.map((id, i) => [id, i]));
  const nameOf = (s: Sheet) => s.definition?.identity?.name || s.name || '';
  return [...byId.values()].sort((a, b) => (order.get(a.id) ?? 1e6) - (order.get(b.id) ?? 1e6) || nameOf(a).localeCompare(nameOf(b)));
}

/** Calls back with the sheets now and whenever one changes; returns how to stop. */
export function followSheets(follow: Follow, onsheets: (sheets: Sheet[]) => void, onerror?: (e: unknown) => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shown: Sheet[] = [];
  const show = (list: Sheet[]) => {
    shown = list;
    if (!stopped) onsheets(list);
  };
  const read = () => readSheets(follow).then(show).catch((e) => !stopped && onerror?.(e));
  /** One sheet changed: read just it, rather than the whole room's. */
  const readOne = async (id: string) => {
    const { data, error } = await supabase.from('sheets').select(COLUMNS).eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    const row = data as Sheet | null;
    const keep = row && (follow.sheets.includes(row.id) || (row.campaign_id && follow.campaigns.includes(row.campaign_id) && !row.retired));
    if (!keep) return show(shown.filter((s) => s.id !== id));
    const done = complete(row!);
    show(shown.some((s) => s.id === id) ? shown.map((s) => (s.id === id ? done : s)) : [...shown, done]);
  };
  const waiting = new Set<string>();
  const soon = (payload?: { eventType?: string; new?: { id?: string } }) => {
    const id = payload?.eventType === 'UPDATE' ? payload.new?.id : undefined;
    waiting.add(id ?? '*');
    clearTimeout(timer);
    timer = setTimeout(() => {
      const ids = [...waiting];
      waiting.clear();
      if (ids.includes('*') || ids.length > 4) void read();
      else ids.forEach((x) => void readOne(x).catch(() => read()));
    }, 250);
  };
  void read();
  if (!isConfigured || (!follow.sheets.length && !follow.campaigns.length)) return () => (stopped = true);
  let ch = supabase.channel(`dndc-room-${Math.random().toString(36).slice(2)}`);
  if (follow.sheets.length)
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'sheets', filter: `id=in.(${follow.sheets.join(',')})` }, soon);
  if (follow.campaigns.length)
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'sheets', filter: `campaign_id=in.(${follow.campaigns.join(',')})` }, soon);
  // Back from sleep or a lost connection: read again rather than trust what is shown.
  const wake = () => document.visibilityState === 'visible' && soon();
  // Joined (or back after a drop): read again in case anything was missed.
  ch.subscribe((status) => status === 'SUBSCRIBED' && soon());
  document.addEventListener('visibilitychange', wake);
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', wake);
    void supabase.removeChannel(ch);
  };
}
