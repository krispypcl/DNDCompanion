import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const update = vi.fn();
type Watch = { row: (c: Record<string, unknown> & { id: string }) => void; gone: (id: string) => void; joined?: () => void };
let heard: Watch | null = null;
vi.mock('#lib/data/creatures.ts', () => ({
  inOrder: (l: { position: number }[]) => [...l].sort((a, b) => a.position - b.position),
  creatureRepo: {
    watch: (_c: string, on: Watch) => {
      heard = on;
      return () => (heard = null);
    },
    list: vi.fn(async () => [{ id: 'a', campaign_id: 'c', kind: 'monster', name: 'Goblin', hp_max: 10, hp_current: 10, hp_temp: 0, ac: 15, conditions: [], notes: '', link: '', position: 0, initiative: null, visible: false, statblock: {}, created_at: '', updated_at: '' }]),
    update: (...a: unknown[]) => update(...a),
    homebrew: { list: vi.fn(async () => []) }
  }
}));

const { CreatureTable } = await import('#lib/creatureTable.svelte.ts');

describe('CreatureTable saves', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    update.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('shows each change at once and saves a quick run once', async () => {
    const t = new CreatureTable('c');
    await t.load();
    update.mockResolvedValue(undefined);
    void t.change(t.list[0], { hp_current: 7 });
    void t.change(t.list[0], { hp_current: 4 });
    const last = t.change(t.list[0], { hp_current: 6, conditions: ['Prone'] });
    expect(t.list[0].hp_current).toBe(6);
    expect(update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CreatureTable.SAVE_AFTER);
    await last;
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith('a', { hp_current: 6, conditions: ['Prone'] });
  });

  it('never has two saves in flight for one creature', async () => {
    const t = new CreatureTable('c');
    await t.load();
    let release = () => {};
    update.mockImplementationOnce(() => new Promise<void>((r) => (release = r))).mockResolvedValue(undefined);
    void t.change(t.list[0], { hp_current: 8 });
    await vi.advanceTimersByTimeAsync(CreatureTable.SAVE_AFTER);
    const second = t.change(t.list[0], { hp_current: 2 });
    await vi.advanceTimersByTimeAsync(CreatureTable.SAVE_AFTER);
    expect(update).toHaveBeenCalledTimes(1);
    release();
    await second;
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[1]).toEqual(['a', { hp_current: 2 }]);
  });

  it('goes back to what was saved when a save fails', async () => {
    const t = new CreatureTable('c');
    await t.load();
    update.mockRejectedValue(new Error('offline'));
    const done = t.change(t.list[0], { hp_current: 1 });
    await vi.advanceTimersByTimeAsync(CreatureTable.SAVE_AFTER);
    await done;
    expect(t.list[0].hp_current).toBe(10);
    expect(t.error).toBeTruthy();
  });
});

describe('CreatureTable live', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    update.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('takes a change made elsewhere, merged onto the row it has', async () => {
    const t = new CreatureTable('c');
    await t.load();
    const stop = t.follow();
    heard!.row({ id: 'a', hp_current: 3 });
    expect(t.list[0].hp_current).toBe(3);
    expect(t.list[0].name).toBe('Goblin');
    heard!.gone('a');
    expect(t.list).toEqual([]);
    stop();
    expect(heard).toBeNull();
  });

  it('keeps its own change while it waits to be saved', async () => {
    const t = new CreatureTable('c');
    await t.load();
    t.follow();
    update.mockResolvedValue(undefined);
    const done = t.change(t.list[0], { hp_current: 5 });
    heard!.row({ id: 'a', hp_current: 9 });
    expect(t.list[0].hp_current).toBe(5);
    await vi.advanceTimersByTimeAsync(CreatureTable.SAVE_AFTER);
    await done;
    expect(update).toHaveBeenCalledWith('a', { hp_current: 5 });
  });
});
