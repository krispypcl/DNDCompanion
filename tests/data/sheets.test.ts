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
        insert: (payload: unknown) => builder(table, 'insert', payload),
        delete: () => builder(table, 'delete')
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

  /**
   * The row's `name` column exists so the sheet list and, later, the DM view can
   * be queried without pulling every definition. It is a projection of the
   * character's name, so it is written with the definition rather than kept as a
   * second name that drifts.
   */
  test('saveDefinition writes the definition and the name it projects', async () => {
    const { client, calls } = fakeClient({ updateRows: [{ updated_at: 'T2' }] });
    const repo = makeSheetRepo(client);

    await repo.saveDefinition('sheet-1', definition, 'T1');

    const payload = calls[0].payload as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['definition', 'name']);
    expect(payload.name).toBe('Loka Sibbs');
    expect(payload).not.toHaveProperty('state');
  });

  test.each([
    ['an empty name', ''],
    ['whitespace only', '   '],
    ['a missing name', undefined]
  ])('falls back to a placeholder for %s rather than a blank list entry', async (_label, name) => {
    const { client, calls } = fakeClient({ updateRows: [{ updated_at: 'T2' }] });
    const repo = makeSheetRepo(client);

    await repo.saveDefinition(
      'sheet-1',
      { identity: { name, level: 1 } } as unknown as Definition,
      'T1'
    );

    expect((calls[0].payload as Record<string, unknown>).name).toBe('Untitled sheet');
  });

  test('saveDefinition trims the projected name', async () => {
    const { client, calls } = fakeClient({ updateRows: [{ updated_at: 'T2' }] });
    const repo = makeSheetRepo(client);

    await repo.saveDefinition(
      'sheet-1',
      { identity: { name: '  Loka  ', level: 1 } } as unknown as Definition,
      'T1'
    );

    expect((calls[0].payload as Record<string, unknown>).name).toBe('Loka');
  });

  test('deleteSheet removes the row by id', async () => {
    const { client, calls } = fakeClient({ updateRows: [] });
    const repo = makeSheetRepo(client);

    await repo.deleteSheet('sheet-1');

    expect(calls[0].op).toBe('delete');
    expect(calls[0].filters).toEqual([['id', 'sheet-1']]);
  });

  test('deleteSheet surfaces a refusal rather than reporting success', async () => {
    const { client } = fakeClient({ error: { message: 'permission denied for table sheets' } });
    const repo = makeSheetRepo(client);

    await expect(repo.deleteSheet('not-mine')).rejects.toThrow(/permission denied/);
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
