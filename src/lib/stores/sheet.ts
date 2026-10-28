import { get, writable, type Readable } from 'svelte/store';
import { StaleWriteError, sheetRepo } from '$lib/data/sheets';
import type { Definition, Sheet, State } from '$lib/types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'stale' | 'error';

const DEBOUNCE_MS = 500;
const RETRIES = 2;

type Store = {
  sheet: Sheet | null;
  status: SaveStatus;
  message: string | null;
};

function createSheetStore() {
  const store = writable<Store>({ sheet: null, status: 'idle', message: null });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { definition?: Definition; state?: State } = {};

  function setStatus(status: SaveStatus, message: string | null = null) {
    store.update((s) => ({ ...s, status, message }));
  }

  async function flush() {
    const current = get(store).sheet;
    if (!current) return;
    const work = pending;
    pending = {};
    if (!work.definition && !work.state) return;

    setStatus('saving');
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        let updatedAt = current.updated_at;
        if (work.definition) {
          updatedAt = await sheetRepo.saveDefinition(current.id, work.definition, updatedAt);
        }
        if (work.state) {
          updatedAt = await sheetRepo.saveState(current.id, work.state, updatedAt);
        }
        store.update((s) => ({
          ...s,
          sheet: s.sheet ? { ...s.sheet, updated_at: updatedAt } : s.sheet,
          status: 'saved',
          message: null
        }));
        return;
      } catch (error) {
        if (error instanceof StaleWriteError) {
          // Never overwrite newer data. The value stays on screen; the user decides.
          setStatus('stale', error.message);
          return;
        }
        if (attempt === RETRIES) {
          setStatus('unsaved', error instanceof Error ? error.message : 'Could not save');
          return;
        }
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }

  function schedule() {
    setStatus('unsaved');
    clearTimeout(timer);
    timer = setTimeout(flush, DEBOUNCE_MS);
  }

  return {
    subscribe: store.subscribe satisfies Readable<Store>['subscribe'],

    load(sheet: Sheet | null) {
      pending = {};
      clearTimeout(timer);
      store.set({ sheet, status: 'idle', message: null });
    },

    /** Replace the live state and queue a save. */
    setState(next: State) {
      store.update((s) => (s.sheet ? { ...s, sheet: { ...s.sheet, state: next } } : s));
      pending.state = next;
      schedule();
    },

    /** Replace the definition and queue a save. */
    setDefinition(next: Definition) {
      store.update((s) => (s.sheet ? { ...s, sheet: { ...s.sheet, definition: next } } : s));
      pending.definition = next;
      schedule();
    },

    flushNow: flush
  };
}

export const sheetStore = createSheetStore();
