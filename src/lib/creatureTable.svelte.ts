/**
 * The DM's monsters and NPCs for one campaign, as the campaign page holds
 * them: the list, kept in step with the database (each change shown at once,
 * saved behind, put back if the save fails), the DM's own homebrew to add
 * from, and adding a monster straight from 5e.tools.
 */
import { creatureRepo, type Creature, type CreatureFields, type Homebrew } from '$lib/data/creatures';
import { friendlyError } from '$lib/errors';
import { findMonster } from '$lib/rules/fiveData';
import { fromFiveTools, leadingNumber, type StatBlock } from '$lib/rules/statblock';
import { numberedNames, type CreatureKind } from '$lib/rules/creatures';
import { entryUrl } from '$lib/rules/spotlight';

export class CreatureTable {
  list = $state<Creature[]>([]);
  homebrew = $state<Homebrew[]>([]);
  loading = $state(true);
  error = $state<string | null>(null);
  /** A short word on what just happened ("Added Goblin Boss"). */
  notice = $state<string | null>(null);
  readonly campaignId: string;
  #noticeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(campaignId: string) {
    this.campaignId = campaignId;
  }

  async load() {
    this.loading = true;
    try {
      const [list, brew] = await Promise.all([creatureRepo.list(this.campaignId), creatureRepo.homebrew.list().catch(() => [])]);
      this.list = list;
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

  async change(c: Creature, patch: CreatureFields) {
    const before = this.list;
    this.list = this.list.map((x) => (x.id === c.id ? { ...x, ...patch } : x));
    try {
      await creatureRepo.update(c.id, patch);
    } catch (e) {
      this.list = before;
      this.error = friendlyError(e, 'That change rolled a natural 1! Try it again.');
    }
  }

  /** Several of one creature (numbered on from those there), at the end of the list. */
  async add(base: { name: string; kind: CreatureKind; hp_max: number | null; ac: number | null; link: string; statblock: StatBlock; notes?: string }, count = 1) {
    const names = numberedNames(base.name, count, this.list.map((x) => x.name));
    const top = this.list.reduce((m, x) => Math.max(m, x.position), 0);
    const rows: CreatureFields[] = names.map((name, i) => ({
      name, kind: base.kind, hp_max: base.hp_max, hp_current: base.hp_max, ac: base.ac, link: base.link,
      statblock: base.statblock, notes: base.notes ?? '', position: top + i + 1
    }));
    try {
      const made = await creatureRepo.add(this.campaignId, rows);
      this.list = [...this.list, ...made];
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
        link: entryUrl(m.name, 'm', m.source), statblock
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
      name: h.name, kind: h.kind, hp_max: leadingNumber(h.statblock.hp), ac: leadingNumber(h.statblock.ac), link: '', statblock: h.statblock
    }, count);
  }

  async remove(c: Creature) {
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
  async keepHomebrew(row: { id?: string; kind: CreatureKind; name: string; statblock: StatBlock }) {
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
