import { describe, expect, test, vi } from 'vitest';
import { StaleWriteError, makeSheetRepo } from '$lib/data/sheets';
import { emptyState, type Definition } from '$lib/types';

/** A fake just large enough for the calls the repo makes. */
function fakeClient(opts: { updateRows?: unknown[]; selectRow?: unknown; error?: unknown } = {}) {
  const calls: { table: string; op: string; payload?: unknown; filters: [string, unknown][] }[] = [];

  const builder = (table: string, op: string, payload?: unknown) => {
    const filters: [string, unknown][] = [];
    const node: Record<string, unknown> = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return node;
      },
      select() {
        return node;
      },
      maybeSingle() {
        calls.push({ table, op, payload, filters });
        return Promise.resolve({ data: opts.selectRow ?? null, error: opts.error ?? null });
      },
      then(resolve: (v: unknown) => void) {
        calls.push({ table, op, payload, filters });
        return Promise.resolve({ data: opts.updateRows ?? [], error: opts.error ?? null }).then(
          resolve
        );
      }
    };
    return node;
  };

  return {
    calls,
    client: {
      from: (table: string) => ({
        select: () => builder(table, 'select'),
        update: (payload: unknown) => builder(table, 'update', payload),
        insert: (payload: unknown) => builder(table, 'insert', payload)
      })
    } as never
  };
}

const definition = { identity: { name: 'Loka Sibbs', level: 5 } } as unknown as Definition;

describe('sheet repository', () => {
  test('saveState writes only the state column', async () => {
    const { client, calls } = fakeClient({ updateRows: [{ updated_at: 'T2' }] });
    const repo = makeSheetRepo(client);

    await repo.saveState('sheet-1', emptyState(), 'T1');

    const payload = calls[0].payload as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['state']);
    expect(payload).not.toHaveProperty('definition');
  });

  test('saveDefinition writes only the definition column', async () => {
    const { client, calls } = fakeClient({ updateRows: [{ updated_at: 'T2' }] });
    const repo = makeSheetRepo(client);

    await repo.saveDefinition('sheet-1', definition, 'T1');

    const payload = calls[0].payload as Record<string, unknown>;
    expect(Object.keys(payload)).toEqual(['definition']);
    expect(payload).not.toHaveProperty('state');
  });

  test('a save is guarded by the expected updated_at', async () => {
    const { client, calls } = fakeClient({ updateRows: [{ updated_at: 'T2' }] });
    const repo = makeSheetRepo(client);

    await repo.saveState('sheet-1', emptyState(), 'T1');

    expect(calls[0].filters).toEqual([
      ['id', 'sheet-1'],
      ['updated_at', 'T1']
    ]);
  });

  test('a save resolves the new updated_at', async () => {
    const { client } = fakeClient({ updateRows: [{ updated_at: 'T2' }] });
    const repo = makeSheetRepo(client);

    await expect(repo.saveState('sheet-1', emptyState(), 'T1')).resolves.toBe('T2');
  });

  // Review Focus 4: a second tab holding older data must not overwrite newer.
  test('a stale updated_at rejects with StaleWriteError and writes nothing', async () => {
    const { client } = fakeClient({ updateRows: [] });
    const repo = makeSheetRepo(client);

    await expect(repo.saveState('sheet-1', emptyState(), 'STALE')).rejects.toBeInstanceOf(
      StaleWriteError
    );
  });

  test('loadSheet returns null for an unknown id', async () => {
    const { client } = fakeClient({ selectRow: null });
    const repo = makeSheetRepo(client);

    await expect(repo.loadSheet('nope')).resolves.toBeNull();
  });
});
