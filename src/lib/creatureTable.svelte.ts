/**
 * The DM's monsters and NPCs for one campaign, as the campaign page holds
 * them: the list, kept in step with the database (each change shown at once,
 * saved behind, put back if the save fails), the DM's own homebrew to add
 * from, and adding a monster straight from 5e.tools.
 *
 * Changes are debounced per creature: a quick run of presses (Damage,
 * Damage, Heal) shows each at once but saves once, a moment after the last,
 * and one creature never has two saves in flight, so they can't land out of
 * order.
 */
import { creatureRepo, type Creature, type CreatureFields, type Homebrew } from '$lib/data/creatures';
import { friendlyError } from '$lib/errors';
import { findMonster } from '$lib/rules/fiveData';
import { fromFiveTools, leadingNumber, monsterArt, type StatBlock } from '$lib/rules/statblock';
import { numberedNames, type CreatureKind } from '$lib/rules/creatures';
import { entryUrl } from '$lib/rules/spotlight';

export class CreatureTable {
  list = $state<Creature[]>([]);
  homebrew = $state<Homebrew[]>([]);
  loading = $state(true);
  error = $state<string | null>(null);
  /** The database still waits on 0020: no portraits or condition colours yet. TODO: drop once 0020 has run. */
  before0020 = $state(false);
  /** A short word on what just happened ("Added Goblin Boss"). */
  notice = $state<string | null>(null);
  readonly campaignId: string;
  #noticeTimer: ReturnType<typeof setTimeout> | undefined;
  /** Each creature as the database last confirmed it (what a failed save goes back to). */
  #saved = new Map<string, Creature>();
  /** Changes waiting to be saved, merged, with who is waiting on them. */
  #pending = new Map<string, { patch: CreatureFields; timer: ReturnType<typeof setTimeout>; done: (() => void)[] }>();
  /** The save in flight for each creature, so the next one waits its turn. */
  #flying = new Map<string, Promise<void>>();
  static readonly SAVE_AFTER = 350;

  constructor(campaignId: string) {
    this.campaignId = campaignId;
  }

  async load() {
    this.loading = true;
    try {
      const [list, brew] = await Promise.all([creatureRepo.list(this.campaignId), creatureRepo.homebrew.list().catch(() => [])]);
      this.list = list;
      this.#saved = new Map(list.map((x) => [x.id, x]));
      this.before0020 = creatureRepo.before0020;
      this.homebrew = brew;
    } catch (e) {
      this.error = friendlyError(e, 'The monsters slipped their leash! Try again in a moment.');
    } finally {
      this.loading = false;
    }
  }

  #say(text: string) {
    this.notice = text;
    clearTimeout(this.#noticeTimer);
    this.#noticeTimer = setTimeout(() => (this.notice = null), 3500);
  }

  /** Shows the change at once; saves it (with any that follow quickly) a moment after the last. */
  change(c: Creature, patch: CreatureFields): Promise<void> {
    this.list = this.list.map((x) => (x.id === c.id ? { ...x, ...patch } : x));
    const was = this.#pending.get(c.id);
    if (was) clearTimeout(was.timer);
    const entry = { patch: { ...(was?.patch ?? {}), ...patch }, timer: undefined as unknown as ReturnType<typeof setTimeout>, done: was?.done ?? [] };
    const settled = new Promise<void>((resolve) => entry.done.push(resolve));
    entry.timer = setTimeout(() => void this.#flush(c.id), CreatureTable.SAVE_AFTER);
    this.#pending.set(c.id, entry);
    return settled;
  }

  /** Saves whatever is waiting now (leaving the page, or the table closing). */
  flushAll() {
    for (const [id, entry] of this.#pending) {
      clearTimeout(entry.timer);
      void this.#flush(id);
    }
  }

  async #flush(id: string) {
    const entry = this.#pending.get(id);
    if (!entry) return;
    this.#pending.delete(id);
    const before = this.#flying.get(id) ?? Promise.resolve();
    const run = before.then(async () => {
      try {
        await creatureRepo.update(id, entry.patch);
        const base = this.#saved.get(id);
        if (base) this.#saved.set(id, { ...base, ...entry.patch });
      } catch (e) {
        // Back to what the database has, keeping any newer change still waiting.
        const base = this.#saved.get(id);
        const newer = this.#pending.get(id)?.patch ?? {};
        if (base) this.list = this.list.map((x) => (x.id === id ? { ...base, ...newer } : x));
        this.error = friendlyError(e, 'That change rolled a natural 1! Try it again.');
      }
    });
    this.#flying.set(id, run);
    await run;
    if (this.#flying.get(id) === run) this.#flying.delete(id);
    entry.done.forEach((d) => d());
  }

  /** Several of one creature (numbered on from those there), at the end of the list. */
  async add(base: { name: string; kind: CreatureKind; hp_max: number | null; ac: number | null; link: string; statblock: StatBlock; notes?: string; portrait?: string }, count = 1) {
    const names = numberedNames(base.name, count, this.list.map((x) => x.name));
    const top = this.list.reduce((m, x) => Math.max(m, x.position), 0);
    const rows: CreatureFields[] = names.map((name, i) => ({
      name, kind: base.kind, hp_max: base.hp_max, hp_current: base.hp_max, ac: base.ac, link: base.link,
      statblock: base.statblock, notes: base.notes ?? '', position: top + i + 1, portrait: base.portrait ?? ''
    }));
    try {
      const made = await creatureRepo.add(this.campaignId, rows);
      this.list = [...this.list, ...made];
      for (const m of made) this.#saved.set(m.id, m);
      this.#say(names.length > 1 ? `Added ${names[0]} to ${names[names.length - 1]}` : `Added ${names[0]}`);
      return made;
    } catch (e) {
      this.error = friendlyError(e, 'That one refused to be summoned! Try again.');
      return [];
    }
  }

  /** A monster from 5e.tools, with its stat block, hit points and armour class. */
  async addFromFive(name: string, source: string, count = 1) {
    try {
      const m = await findMonster(name, source);
      if (!m) throw new Error('missing');
      const statblock = fromFiveTools(m);
      return await this.add({
        name: m.name, kind: 'monster', hp_max: leadingNumber(statblock.hp), ac: leadingNumber(statblock.ac),
        link: entryUrl(m.name, 'm', m.source), statblock, portrait: monsterArt(m)
      }, count);
    } catch {
      this.error = `${name} wouldn’t come out of the book! Try again in a moment.`;
      return [];
    }
  }

  async addHomebrew(id: string, count = 1) {
    const h = this.homebrew.find((x) => x.id === id);
    if (!h) return [];
    return this.add({
      name: h.name, kind: h.kind, hp_max: leadingNumber(h.statblock.hp), ac: leadingNumber(h.statblock.ac), link: '', statblock: h.statblock,
      portrait: h.portrait
    }, count);
  }

  async remove(c: Creature) {
    const waiting = this.#pending.get(c.id);
    if (waiting) {
      clearTimeout(waiting.timer);
      this.#pending.delete(c.id);
      waiting.done.forEach((d) => d());
    }
    const before = this.list;
    this.list = this.list.filter((x) => x.id !== c.id);
    try {
      await creatureRepo.remove(c.id);
    } catch (e) {
      this.list = before;
      this.error = friendlyError(e, 'It won’t leave the table! Try removing it again.');
    }
  }

  /** A new order, from a drag. */
  async reorder(ids: string[]) {
    const before = this.list;
    const at = new Map(ids.map((id, i) => [id, i]));
    this.list = [...this.list].map((x) => ({ ...x, position: at.get(x.id) ?? x.position })).sort((a, b) => a.position - b.position);
    try {
      await creatureRepo.reorder(ids);
    } catch (e) {
      this.list = before;
      this.error = friendlyError(e, 'They wouldn’t line up! Try moving it again.');
    }
  }

  /** Kept in the DM's homebrew, to add to any campaign (a new one, or changes to one there). */
  async keepHomebrew(row: { id?: string; kind: CreatureKind; name: string; statblock: StatBlock; portrait?: string }) {
    try {
      const saved = await creatureRepo.homebrew.save(row);
      this.homebrew = [...this.homebrew.filter((h) => h.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name));
      this.#say(`${saved.name} is in your homebrew`);
      return saved;
    } catch (e) {
      this.error = friendlyError(e, 'Your homebrew wouldn’t take it! Try again.');
      return null;
    }
  }

  async forgetHomebrew(id: string) {
    const before = this.homebrew;
    this.homebrew = this.homebrew.filter((h) => h.id !== id);
    try {
      await creatureRepo.homebrew.remove(id);
    } catch (e) {
      this.homebrew = before;
      this.error = friendlyError(e, 'It clung to your homebrew! Try again.');
    }
  }
}
