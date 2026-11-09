/** Notes and backstory are saved on their own, in an order that cannot lose them. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const calls: string[] = [];
const repo = vi.hoisted(() => ({
  saveDefinition: vi.fn(),
  saveState: vi.fn(),
  saveText: vi.fn(),
  loadRow: vi.fn(async () => null as unknown),
  rowStamp: vi.fn(async () => null as unknown)
}));
vi.mock('$lib/data/sheets', () => {
  class StaleWriteError extends Error {
    constructor() { super('This sheet was changed somewhere else.'); this.name = 'StaleWriteError'; }
  }
  return { sheetRepo: repo, StaleWriteError };
});

import { StaleWriteError } from '$lib/data/sheets';
import { onlyVitalsChanged, scrubText, sheetStore } from '$lib/stores/sheet';
import { blankDefinition } from '$lib/sample';
import { blankTexts, emptyState, type Definition, type Sheet, type SheetTexts } from '$lib/types';

function sheet(over: { definition?: Partial<Definition>; texts?: SheetTexts | null } = {}): Sheet {
  return {
    id: 's1', owner_id: 'u1', campaign_id: null, name: 'T', retired: false,
    definition: { ...blankDefinition('T'), ...over.definition },
    state: emptyState(), created_at: 'c', updated_at: 'T0',
    texts: over.texts === undefined ? blankTexts() : over.texts
  };
}

const settle = async () => { await vi.advanceTimersByTimeAsync(600); };

describe('saving text', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    calls.length = 0;
    repo.saveDefinition.mockReset().mockImplementation(async () => { calls.push('definition'); return 'T-def'; });
    repo.saveState.mockReset().mockImplementation(async () => { calls.push('state'); return 'T-state'; });
    repo.saveText.mockReset().mockImplementation(async (_s, _o, key: string) => { calls.push(`text:${key}`); return `T-${key}`; });
  });
  afterEach(() => vi.useRealTimers());

  it('writes a first save as an insert, then guards the next on what came back', async () => {
    sheetStore.load(sheet());
    sheetStore.setText('notes', { body: 'one' });
    await settle();
    expect(repo.saveText).toHaveBeenLastCalledWith('s1', 'u1', 'notes', 'one', true, null);
    sheetStore.setText('notes', { body: 'two' });
    await settle();
    expect(repo.saveText).toHaveBeenLastCalledWith('s1', 'u1', 'notes', 'two', true, 'T-notes');
  });

  it('changes who may read it without touching the words, and keeps the words with it', async () => {
    const texts = blankTexts();
    texts.backstory = { body: 'The secret', isPublic: true, updatedAt: 'T1' };
    sheetStore.load(sheet({ texts }));
    sheetStore.setText('backstory', { isPublic: false });
    await settle();
    expect(repo.saveText).toHaveBeenCalledWith('s1', 'u1', 'backstory', 'The secret', false, 'T1');
    expect(get(sheetStore).sheet!.texts!.backstory.isPublic).toBe(false);
  });

  it('merges quick edits into one write', async () => {
    sheetStore.load(sheet());
    sheetStore.setText('notes', { body: 'a' });
    sheetStore.setText('notes', { body: 'ab' });
    sheetStore.setText('notes', { isPublic: false });
    await settle();
    expect(repo.saveText).toHaveBeenCalledTimes(1);
    expect(repo.saveText).toHaveBeenCalledWith('s1', 'u1', 'notes', 'ab', false, null);
  });

  it('never puts the text in the definition it saves', async () => {
    sheetStore.load(sheet());
    sheetStore.setDefinition({ ...blankDefinition('T'), notes: 'leaked', backstory: 'leaked too' });
    await settle();
    const saved = repo.saveDefinition.mock.calls[0][1] as Definition;
    expect(saved.notes).toBe('');
    expect('backstory' in saved).toBe(false);
  });

  it('moves old in-sheet text across before it clears it, so nothing is lost', async () => {
    const texts = blankTexts();
    texts.notes = { body: 'Old notes', isPublic: true, updatedAt: null };
    sheetStore.load(sheet({ definition: { notes: 'Old notes' }, texts }));
    // The owner edits something unrelated; the old notes must still be saved.
    sheetStore.setText('backstory', { body: 'New story' });
    await settle();
    expect(repo.saveText).toHaveBeenCalledWith('s1', 'u1', 'notes', 'Old notes', true, null);
    expect(repo.saveText).toHaveBeenCalledWith('s1', 'u1', 'backstory', 'New story', true, null);
    // Text before definition: the clearing only happens once the words are safe.
    expect(calls.indexOf('definition')).toBeGreaterThan(calls.indexOf('text:notes'));
    expect(calls.indexOf('definition')).toBeGreaterThan(calls.indexOf('text:backstory'));
    expect((repo.saveDefinition.mock.calls[0][1] as Definition).notes).toBe('');
  });

  it('also moves it across when the edit was to something else entirely', async () => {
    const texts = blankTexts();
    texts.notes = { body: 'Old notes', isPublic: true, updatedAt: null };
    sheetStore.load(sheet({ definition: { notes: 'Old notes' }, texts }));
    sheetStore.setDefinition({ ...blankDefinition('T'), notes: 'Old notes', proficiency: 3 });
    await settle();
    expect(repo.saveText).toHaveBeenCalledWith('s1', 'u1', 'notes', 'Old notes', true, null);
  });

  it('does not clear the definition if the words could not be saved', async () => {
    repo.saveText.mockReset().mockRejectedValue(new Error('network'));
    const texts = blankTexts();
    sheetStore.load(sheet({ definition: { notes: 'Old notes' }, texts: { ...texts, notes: { body: 'Old notes', isPublic: true, updatedAt: null } } }));
    sheetStore.setText('notes', { body: 'Old notes!' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(repo.saveDefinition).not.toHaveBeenCalled();
    expect(get(sheetStore).status).toBe('unsaved');
  });

  it('reports a text changed on another device rather than overwriting it', async () => {
    repo.saveText.mockReset().mockRejectedValue(new StaleWriteError());
    sheetStore.load(sheet());
    sheetStore.setText('notes', { body: 'mine' });
    await settle();
    expect(get(sheetStore).status).toBe('stale');
  });

  it('keeps the words in the definition when the database has no table for them', async () => {
    sheetStore.load(sheet({ texts: null }));
    sheetStore.setText('notes', { body: 'old way' });
    await settle();
    expect(repo.saveText).not.toHaveBeenCalled();
    expect((repo.saveDefinition.mock.calls[0][1] as Definition).notes).toBe('old way');
  });

  it('scrubText leaves everything else alone', () => {
    const d = { ...blankDefinition('T'), notes: 'x', backstory: 'y', proficiency: 4 };
    const out = scrubText(d);
    expect(out.notes).toBe('');
    expect('backstory' in out).toBe(false);
    expect(out.proficiency).toBe(4);
  });
});

describe('a save that cannot land', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    repo.saveDefinition.mockReset().mockResolvedValue('T-def');
    repo.saveText.mockReset().mockResolvedValue('T-t');
  });
  afterEach(() => vi.useRealTimers());

  it('keeps the change, reports it unsaved, and sends it on retry', async () => {
    repo.saveState.mockReset().mockRejectedValue(new Error('Failed to fetch'));
    sheetStore.load(sheet());
    sheetStore.setState({ ...emptyState(), hpCurrent: 7 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(sheetStore.hasUnsaved()).toBe(true);
    expect(get(sheetStore).status).toBe('unsaved');

    repo.saveState.mockReset().mockResolvedValue('T-ok');
    await sheetStore.retry();
    expect(repo.saveState).toHaveBeenCalledWith('s1', expect.objectContaining({ hpCurrent: 7 }), 'T0');
    expect(sheetStore.hasUnsaved()).toBe(false);
  });

  it('keeps a newer change over the one that failed', async () => {
    repo.saveState.mockReset().mockImplementationOnce(async () => {
      sheetStore.setState({ ...emptyState(), hpCurrent: 9 });
      throw new Error('Failed to fetch');
    }).mockRejectedValue(new Error('Failed to fetch'));
    sheetStore.load(sheet());
    sheetStore.setState({ ...emptyState(), hpCurrent: 7 });
    await vi.advanceTimersByTimeAsync(600);
    repo.saveState.mockReset().mockResolvedValue('T-ok');
    await vi.advanceTimersByTimeAsync(3000);
    await sheetStore.retry();
    expect(repo.saveState).toHaveBeenLastCalledWith('s1', expect.objectContaining({ hpCurrent: 9 }), expect.anything());
  });
});

describe('hit points changed elsewhere (the map, the DM)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    repo.saveDefinition.mockReset().mockResolvedValue('T-def');
    repo.saveText.mockReset().mockResolvedValue('T-t');
  });
  afterEach(() => {
    vi.useRealTimers();
    repo.loadRow.mockReset().mockResolvedValue(null);
  });

  it('tells vitals from everything else', () => {
    const a = { definition: blankDefinition('T'), state: emptyState() };
    expect(onlyVitalsChanged(a, { ...a, state: { ...a.state, hpCurrent: 3, hpTemp: 5 } })).toBe(true);
    expect(onlyVitalsChanged(a, { ...a, definition: { ...a.definition, conditionLooks: {} } })).toBe(true);
    expect(onlyVitalsChanged(a, { ...a, definition: { ...a.definition, identity: { ...a.definition.identity, name: 'X' } } })).toBe(false);
  });

  it('takes their hit points in and saves its own change over them, without a warning', async () => {
    const theirs = { definition: blankDefinition('T'), state: { ...emptyState(), hpCurrent: 3 }, updated_at: 'T1' };
    repo.loadRow.mockReset().mockResolvedValue(theirs);
    repo.saveState.mockReset().mockRejectedValueOnce(new StaleWriteError()).mockResolvedValue('T2');
    sheetStore.load(sheet());
    sheetStore.setState({ ...emptyState(), hpTemp: 4 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(get(sheetStore).status).not.toBe('stale');
    expect(repo.saveState).toHaveBeenLastCalledWith('s1', expect.objectContaining({ hpCurrent: 3, hpTemp: 4 }), 'T1');
    expect(get(sheetStore).sheet?.state.hpCurrent).toBe(3);
  });

  it('keeps hit points this person just changed over the ones from elsewhere', async () => {
    const theirs = { definition: blankDefinition('T'), state: { ...emptyState(), hpCurrent: 3 }, updated_at: 'T1' };
    repo.loadRow.mockReset().mockResolvedValue(theirs);
    repo.saveState.mockReset().mockRejectedValueOnce(new StaleWriteError()).mockResolvedValue('T2');
    sheetStore.load(sheet());
    sheetStore.setState({ ...emptyState(), hpCurrent: 9 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(repo.saveState).toHaveBeenLastCalledWith('s1', expect.objectContaining({ hpCurrent: 9 }), 'T1');
  });

  it('still warns when something else changed', async () => {
    const theirs = { definition: { ...blankDefinition('T'), identity: { ...blankDefinition('T').identity, name: 'Other' } }, state: emptyState(), updated_at: 'T1' };
    repo.loadRow.mockReset().mockResolvedValue(theirs);
    repo.saveState.mockReset().mockRejectedValue(new StaleWriteError());
    sheetStore.load(sheet());
    sheetStore.setState({ ...emptyState(), hpCurrent: 9 });
    await vi.advanceTimersByTimeAsync(3000);
    expect(get(sheetStore).status).toBe('stale');
  });
});
