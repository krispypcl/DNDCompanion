import { describe, expect, it } from 'vitest';
import { StaleWriteError, isMissingTable, makeSheetRepo } from '$lib/data/sheets';
import type { Definition } from '$lib/types';

/** A client whose every table answers with whatever it is told to. */
function client(answers: Record<string, { data?: unknown; error?: unknown }>, seen: Record<string, unknown>[] = []) {
  const chain = (table: string, op: string, payload?: unknown) => {
    const filters: [string, unknown][] = [];
    const answer = () => {
      seen.push({ table, op, payload, filters });
      return Promise.resolve({ data: null, error: null, ...(answers[`${table}.${op}`] ?? answers[table] ?? {}) });
    };
    const node: Record<string, unknown> = {
      eq(c: string, v: unknown) { filters.push([c, v]); return node; },
      select() { return node; },
      limit() { return node; },
      maybeSingle: answer,
      then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) { return answer().then(resolve, reject); }
    };
    return node;
  };
  return {
    from: (table: string) => ({
      select: () => chain(table, 'select'),
      update: (p: unknown) => chain(table, 'update', p),
      insert: (p: unknown) => chain(table, 'insert', p),
      delete: () => chain(table, 'delete')
    })
  } as never;
}

const legacy = (extra: Partial<Definition> = {}) =>
  ({ identity: { name: 'X', level: 1 }, notes: '', ...extra }) as Definition;

describe('isMissingTable', () => {
  it('recognises the two ways a missing table is reported', () => {
    expect(isMissingTable({ code: '42P01', message: 'x' })).toBe(true);
    expect(isMissingTable({ code: 'PGRST205', message: 'x' })).toBe(true);
    expect(isMissingTable({ message: "Could not find the table 'public.sheet_text' in the schema cache" })).toBe(true);
  });
  it('does not mistake any other failure for it', () => {
    expect(isMissingTable({ code: '42501', message: 'permission denied for table sheet_text' })).toBe(false);
    expect(isMissingTable({ message: 'Failed to fetch' })).toBe(false);
    expect(isMissingTable(null)).toBe(false);
  });
});

describe('loadTexts', () => {
  it('reads what the database returned', async () => {
    const repo = makeSheetRepo(client({
      sheet_text: { data: [
        { field: 'notes', body: 'N', is_public: false, updated_at: 'T1' },
        { field: 'backstory', body: 'B', is_public: true, updated_at: 'T2' }
      ] }
    }));
    expect(await repo.loadTexts({ id: 's', definition: legacy() })).toEqual({
      notes: { body: 'N', isPublic: false, updatedAt: 'T1' },
      backstory: { body: 'B', isPublic: true, updatedAt: 'T2' }
    });
  });

  it('treats a missing row as unwritten, and public', async () => {
    const repo = makeSheetRepo(client({ sheet_text: { data: [] } }));
    const t = await repo.loadTexts({ id: 's', definition: legacy() });
    expect(t).toEqual({
      notes: { body: '', isPublic: true, updatedAt: null },
      backstory: { body: '', isPublic: true, updatedAt: null }
    });
  });

  it('shows writing that is still in the sheet, until it has been moved', async () => {
    const repo = makeSheetRepo(client({ sheet_text: { data: [] } }));
    const t = await repo.loadTexts({ id: 's', definition: legacy({ notes: 'old notes', backstory: 'old story' }) });
    expect(t!.notes).toEqual({ body: 'old notes', isPublic: true, updatedAt: null });
    expect(t!.backstory.body).toBe('old story');
  });

  it('lets a saved row win over what is left in the sheet', async () => {
    const repo = makeSheetRepo(client({
      sheet_text: { data: [{ field: 'notes', body: 'new', is_public: false, updated_at: 'T9' }] }
    }));
    const t = await repo.loadTexts({ id: 's', definition: legacy({ notes: 'stale' }) });
    expect(t!.notes).toEqual({ body: 'new', isPublic: false, updatedAt: 'T9' });
  });

  it('ignores a row for a field it does not know', async () => {
    const repo = makeSheetRepo(client({ sheet_text: { data: [{ field: 'secrets', body: 'x', is_public: true, updated_at: 'T' }] } }));
    const t = await repo.loadTexts({ id: 's', definition: legacy() });
    expect(Object.keys(t!)).toEqual(['notes', 'backstory']);
  });

  it('is null, not an error, when the table has not been created', async () => {
    const repo = makeSheetRepo(client({ sheet_text: { error: { code: 'PGRST205', message: 'schema cache' } } }));
    expect(await repo.loadTexts({ id: 's', definition: legacy() })).toBeNull();
  });

  it('is an error when it fails for any other reason', async () => {
    const repo = makeSheetRepo(client({ sheet_text: { error: { code: '500', message: 'boom' } } }));
    await expect(repo.loadTexts({ id: 's', definition: legacy() })).rejects.toThrow('boom');
  });

  it('is part of loading a sheet', async () => {
    const row = { id: 's', owner_id: 'u', definition: legacy(), state: {} };
    const repo = makeSheetRepo(client({
      'sheets.select': { data: row },
      sheet_text: { data: [{ field: 'notes', body: 'N', is_public: true, updated_at: 'T1' }] }
    }));
    const sheet = await repo.loadSheet('s');
    expect(sheet!.texts!.notes.body).toBe('N');
  });
});

describe('saveText', () => {
  it('inserts the first time, and says who owns it', async () => {
    const seen: Record<string, unknown>[] = [];
    const repo = makeSheetRepo(client({ sheet_text: { data: [{ updated_at: 'T1' }] } }, seen));
    expect(await repo.saveText('s', 'u', 'notes', 'hi', false, null)).toBe('T1');
    expect(seen[0]).toMatchObject({ op: 'insert', payload: { sheet_id: 's', owner_id: 'u', field: 'notes', body: 'hi', is_public: false } });
  });

  it('is stale if the row turned up in the meantime', async () => {
    const repo = makeSheetRepo(client({ sheet_text: { error: { code: '23505', message: 'duplicate' } } }));
    await expect(repo.saveText('s', 'u', 'notes', 'x', true, null)).rejects.toBeInstanceOf(StaleWriteError);
  });

  it('updates only the row it last saw', async () => {
    const seen: Record<string, unknown>[] = [];
    const repo = makeSheetRepo(client({ sheet_text: { data: [{ updated_at: 'T2' }] } }, seen));
    expect(await repo.saveText('s', 'u', 'notes', 'x', true, 'T1')).toBe('T2');
    expect(seen[0].filters).toEqual([['sheet_id', 's'], ['field', 'notes'], ['updated_at', 'T1']]);
    expect(seen[0].payload).toEqual({ body: 'x', is_public: true });
  });

  it('is stale if nothing matched: someone else saved', async () => {
    const repo = makeSheetRepo(client({ sheet_text: { data: [] } }));
    await expect(repo.saveText('s', 'u', 'notes', 'x', true, 'T1')).rejects.toBeInstanceOf(StaleWriteError);
  });
});
