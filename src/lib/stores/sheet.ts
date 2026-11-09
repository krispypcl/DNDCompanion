import { proficiencyBonus } from '$lib/rules/derived';
import { friendlyError } from '$lib/errors';
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

/**
 * The parts of a sheet others may change while its owner has it open: hit
 * points, temporary hit points, conditions and death saves (from the
 * Owlbear Rodeo map, or the DM on the campaign page), and how the DM's
 * conditions look. A change to these elsewhere is folded in, never a
 * conflict.
 */
const VITAL_STATE = ['hpCurrent', 'hpTemp', 'conditions', 'deathSaves'] as const;
function vitalsOf(state: State | null | undefined): Partial<State> {
  const out: Partial<State> = {};
  for (const k of VITAL_STATE) if (state && k in state) (out as Record<string, unknown>)[k] = state[k];
  return out;
}
const withoutVitals = (state: State | null | undefined) => {
  const copy = { ...(state ?? {}) } as Record<string, unknown>;
  for (const k of VITAL_STATE) delete copy[k];
  return copy;
};
const withoutLooks = (def: Definition | null | undefined) => {
  const { conditionLooks: _looks, ...rest } = (def ?? {}) as Definition;
  return rest;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Whether what changed between two copies of a row is only its vitals. */
export function onlyVitalsChanged(
  was: { definition: Definition; state: State },
  now: { definition: Definition; state: State }
): boolean {
  return same(withoutVitals(was.state), withoutVitals(now.state)) && same(withoutLooks(was.definition), withoutLooks(now.definition));
}

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
  /** The row as last read from or written to the database. */
  let base: { definition: Definition; state: State } | null = null;

  /** Someone else's vitals, taken into what is shown and what waits to save. */
  /**
   * Takes in the vitals changed elsewhere, except any this copy changed
   * itself since it last matched the database: those are this person's own
   * doing and go out with the next save. Returns what was taken.
   */
  function takeVitals(row: { definition: Definition; state: State; updated_at: string }) {
    const mine = get(store).sheet;
    const vitals: Partial<State> = {};
    for (const [k, v] of Object.entries(vitalsOf(row.state)) as [keyof State, unknown][]) {
      const touched = base && mine && !same(mine.state?.[k], base.state?.[k]);
      if (!touched) (vitals as Record<string, unknown>)[k] = v;
    }
    const looksTouched = base && mine && !same(mine.definition?.conditionLooks, base.definition?.conditionLooks);
    const looks = looksTouched ? undefined : row.definition?.conditionLooks;
    store.update((s) =>
      s.sheet
        ? {
            ...s,
            sheet: {
              ...s.sheet,
              state: { ...s.sheet.state, ...vitals },
              definition: looks === undefined ? s.sheet.definition : { ...s.sheet.definition, conditionLooks: looks },
              updated_at: row.updated_at
            }
          }
        : s
    );
    if (pending.state) pending.state = { ...pending.state, ...vitals };
    if (pending.definition && looks !== undefined) pending.definition = { ...pending.definition, conditionLooks: looks };
    base = { definition: row.definition, state: row.state };
    return { vitals, looks };
  }

  function setStatus(status: SaveStatus, message: string | null = null) {
    store.update((s) => ({ ...s, status, message }));
  }

  /** The save in flight, if any, so leaving can wait for it. */
  let inflight: Promise<void> | null = null;
  function flush(): Promise<void> {
    const run = save().finally(() => {
      if (inflight === run) inflight = null;
    });
    inflight = run;
    return run;
  }

  async function save() {
    const current = get(store).sheet;
    if (!current) return;
    const work = pending;
    pending = {};
    if (!work.definition && !work.state && !work.texts) return;

    setStatus('saving');
    let from = current.updated_at;
    let merges = 0;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        let updatedAt = from;
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
        const now = get(store).sheet;
        if (now) base = { definition: work.definition ?? base?.definition ?? now.definition, state: work.state ?? base?.state ?? now.state };
        store.update((s) => ({
          ...s,
          sheet: s.sheet ? { ...s.sheet, updated_at: updatedAt } : s.sheet,
          status: 'saved',
          message: null
        }));
        return;
      } catch (error) {
        if (error instanceof StaleWriteError) {
          // Refused because the row changed. If all that changed was hit
          // points or conditions (the map, the DM), take theirs in and save
          // again over it: nothing to warn about.
          const row = merges < 3 && base ? await sheetRepo.loadRow(current.id).catch(() => null) : null;
          if (row && base && onlyVitalsChanged(base, row)) {
            merges += 1;
            const { vitals, looks } = takeVitals(row);
            if (work.state) work.state = { ...work.state, ...vitals };
            if (work.definition && looks !== undefined) work.definition = { ...work.definition, conditionLooks: looks };
            from = row.updated_at;
            attempt -= 1;
            continue;
          }
          // Never overwrite newer data. The value stays on screen; the user decides.
          setStatus('stale', error.message);
          return;
        }
        if (attempt === RETRIES) {
          // Keep what did not land, under anything newer typed since, so the
          // next save (or coming back online) sends it rather than losing it.
          pending = {
            definition: pending.definition ?? work.definition,
            state: pending.state ?? work.state,
            texts: work.texts || pending.texts ? { ...work.texts, ...pending.texts } : undefined
          };
          if (!pending.definition) delete pending.definition;
          if (!pending.state) delete pending.state;
          if (!pending.texts || Object.keys(pending.texts).length === 0) delete pending.texts;
          setStatus(
            'unsaved',
            typeof navigator !== 'undefined' && navigator.onLine === false
              ? 'You’re offline! Your changes are safe and will save when you’re back.'
              : friendlyError(error, 'Your changes didn’t save! Trying again shortly.')
          );
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
      base = sheet ? { definition: sheet.definition, state: sheet.state } : null;
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
      const scrubbed = hasTexts ? scrubText(next) : next;
      // The stored bonus follows the level (it is shown and used from the level
      // anyway); kept in step for exports and older readers.
      const prof = proficiencyBonus(scrubbed);
      const kept = scrubbed.proficiency === prof ? scrubbed : { ...scrubbed, proficiency: prof };
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

    flushNow: flush,

    /**
     * Take on a change made to the sheet's row elsewhere (joining a campaign,
     * retiring), with the row's new stamp, so the next save does not mistake
     * it for someone else's write.
     */
    adoptRow(patch: Partial<Pick<Sheet, 'campaign_id' | 'retired' | 'updated_at'>>) {
      store.update((s) => (s.sheet ? { ...s, sheet: { ...s.sheet, ...patch } } : s));
    },

    /**
     * The sheet's row changed elsewhere (the DM gave a condition, or the
     * owner on another device). With nothing waiting to save, it is taken as
     * it is. With changes waiting, they stay, but the other side's conditions
     * and stamp are taken in, so the next save neither loses the DM's change
     * nor is refused as stale.
     */
    adoptRemote(row: Pick<Sheet, 'definition' | 'state' | 'updated_at'>) {
      const current = get(store).sheet;
      if (!current || !row.updated_at || row.updated_at <= current.updated_at) return;
      const quiet = Object.keys(pending).length === 0 && get(store).status !== 'saving' && get(store).status !== 'unsaved';
      if (quiet) {
        store.update((s) =>
          s.sheet ? { ...s, sheet: { ...s.sheet, definition: row.definition, state: row.state, updated_at: row.updated_at } } : s
        );
        base = { definition: row.definition, state: row.state };
        return;
      }
      // Changes are waiting here. Hit points and conditions from elsewhere
      // are folded in under them; anything else changed elsewhere is left
      // for the save to find, so it is never silently written over.
      if (!base || onlyVitalsChanged(base, row)) takeVitals(row);
    },

    /**
     * A look at the row now and then (and when the page comes back into
     * view), in case a live change was missed: a sleeping tablet drops its
     * connection. Anything newer is taken in as if it had arrived live.
     */
    async check() {
      const current = get(store).sheet;
      if (!current) return;
      const stamp = await sheetRepo.rowStamp(current.id).catch(() => null);
      if (!stamp || stamp <= current.updated_at) return;
      const row = await sheetRepo.loadRow(current.id).catch(() => null);
      if (row) this.adoptRemote(row);
    },

    /** Whether anything typed has not reached the database yet. */
    hasUnsaved() {
      const status = get(store).status;
      return Object.keys(pending).length > 0 || status === 'saving' || status === 'unsaved';
    },

    /** Sends whatever is waiting now (leaving the sheet, coming back online)
        and resolves once nothing is in flight. */
    async retry() {
      clearTimeout(timer);
      if (inflight) await inflight;
      if (Object.keys(pending).length > 0) await flush();
    }
  };
}

export const sheetStore = createSheetStore();
