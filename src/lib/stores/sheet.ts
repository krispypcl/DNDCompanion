import { get, writable, type Readable } from 'svelte/store';
import { StaleWriteError, sheetRepo } from '$lib/data/sheets';
import { TEXT_KEYS, type Definition, type Sheet, type State, type TextKey } from '$lib/types';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'unsaved' | 'stale' | 'error';

const DEBOUNCE_MS = 500;
const RETRIES = 2;

type PendingText = { body: string; isPublic: boolean };

/** The sheet's own copy of the two writings is empty once they live in their
    own rows, so a stale copy cannot be read by anyone who is not meant to. */
export function scrubText(definition: Definition): Definition {
  const { backstory: _gone, ...rest } = definition;
  return { ...rest, notes: '' };
}

const hasLegacyText = (definition: Definition) =>
  TEXT_KEYS.some((key) => typeof definition[key] === 'string' && definition[key] !== '');

type Store = {
  sheet: Sheet | null;
  status: SaveStatus;
  message: string | null;
};

function createSheetStore() {
  const store = writable<Store>({ sheet: null, status: 'idle', message: null });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: {
    definition?: Definition;
    state?: State;
    texts?: Partial<Record<TextKey, PendingText>>;
  } = {};

  function setStatus(status: SaveStatus, message: string | null = null) {
    store.update((s) => ({ ...s, status, message }));
  }

  async function flush() {
    const current = get(store).sheet;
    if (!current) return;
    const work = pending;
    pending = {};
    if (!work.definition && !work.state && !work.texts) return;

    setStatus('saving');
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        let updatedAt = current.updated_at;
        // Writing first, and the definition after: the definition is where the
        // old copy of it is cleared, and that must not happen if this fails.
        for (const key of TEXT_KEYS) {
          const text = work.texts?.[key];
          if (!text) continue;
          const stamp = get(store).sheet?.texts?.[key].updatedAt ?? null;
          const saved = await sheetRepo.saveText(
            current.id, current.owner_id, key, text.body, text.isPublic, stamp
          );
          delete work.texts![key];
          store.update((s) =>
            s.sheet?.texts
              ? { ...s, sheet: { ...s.sheet, texts: { ...s.sheet.texts, [key]: { ...s.sheet.texts[key], updatedAt: saved } } } }
              : s
          );
        }
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

  /**
   * A sheet saved before text had a home of its own still carries its notes
   * and backstory in the definition. The first time anything is saved they are
   * queued to move, so clearing the definition's copy never loses them.
   */
  function adoptLegacyText() {
    const sheet = get(store).sheet;
    if (!sheet?.texts) return;
    for (const key of TEXT_KEYS) {
      const entry = sheet.texts[key];
      if (entry.updatedAt === null && entry.body !== '' && !pending.texts?.[key]) {
        pending.texts = { ...pending.texts, [key]: { body: entry.body, isPublic: entry.isPublic } };
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
      const hasTexts = Boolean(get(store).sheet?.texts);
      if (hasTexts) adoptLegacyText();
      const kept = hasTexts ? scrubText(next) : next;
      store.update((s) => (s.sheet ? { ...s, sheet: { ...s.sheet, definition: kept } } : s));
      pending.definition = kept;
      schedule();
    },

    /**
     * Change what is written, or who may read it, for notes or backstory.
     * Without the table behind it (an older database) the words are kept in
     * the definition as they always were and privacy cannot be offered.
     */
    setText(key: TextKey, patch: Partial<PendingText>) {
      const sheet = get(store).sheet;
      if (!sheet) return;
      if (!sheet.texts) {
        if (patch.body !== undefined) this.setDefinition({ ...sheet.definition, [key]: patch.body });
        return;
      }
      adoptLegacyText();
      const base = pending.texts?.[key] ?? {
        body: sheet.texts[key].body,
        isPublic: sheet.texts[key].isPublic
      };
      const next = { ...base, ...patch };
      pending.texts = { ...pending.texts, [key]: next };
      store.update((s) =>
        s.sheet?.texts
          ? { ...s, sheet: { ...s.sheet, texts: { ...s.sheet.texts, [key]: { ...s.sheet.texts[key], ...next } } } }
          : s
      );
      // Anything still in the readable row is cleared in the same save.
      if (hasLegacyText(sheet.definition)) {
        const cleared = scrubText(pending.definition ?? sheet.definition);
        store.update((s) => (s.sheet ? { ...s, sheet: { ...s.sheet, definition: cleared } } : s));
        pending.definition = cleared;
      }
      schedule();
    },

    flushNow: flush
  };
}

export const sheetStore = createSheetStore();
