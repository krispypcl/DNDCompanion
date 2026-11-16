import { describe, expect, it, vi } from 'vitest';

const state: Record<string, { dm?: boolean; user?: string }[]> = {};
let sync: () => void = () => {};
const channel = {
  on: vi.fn((_t: string, _f: unknown, cb: () => void) => ((sync = cb), channel)),
  subscribe: vi.fn(() => channel),
  presenceState: () => state
};
const removeChannel = vi.fn();
vi.mock('$lib/supabase', () => ({ isConfigured: true, supabase: { channel: vi.fn(() => channel), removeChannel } }));

const { watchTable } = await import('$lib/presence');

describe('who is at the table', () => {
  it('reads the DM and the players from the campaign page’s presence', () => {
    const seen: unknown[] = [];
    const stop = watchTable('c1', (h) => seen.push(h));
    state.a = [{ dm: true, user: 'dm-1' }];
    state.b = [{ dm: false, user: 'p-1' }, { dm: false, user: 'p-1' }];
    state.c = [{ dm: false }];
    sync();
    expect(seen.at(-1)).toEqual({ dm: true, users: ['dm-1', 'p-1'] });
    stop();
    expect(removeChannel).toHaveBeenCalled();
  });
});
