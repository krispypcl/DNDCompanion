/**
 * The initiative order, live (database/0019, campaign_state.initiative): read
 * once, then followed as it changes, on the campaign page, a character's
 * sheet and in Owlbear alike. The DM saves the whole order; a player puts in
 * their own character's number.
 *
 * The DM's saves never overlap: a quick run of presses (Next, Next, Back)
 * shows each at once, and while one save is on its way only the latest
 * order waits to follow it, so the table always ends on the last press.
 * Echoes of the DM's own saves are ignored until the last one has landed.
 */
import { campaignRepo, NO_INITIATIVE, type Initiative } from '#lib/data/campaigns.ts';

export class LiveInitiative {
  state = $state<Initiative>(NO_INITIATIVE);
  /** Read at least once. */
  ready = $state(false);
  readonly campaignId: string;
  /** The order as the database last confirmed it. */
  #confirmed: Initiative = NO_INITIATIVE;
  #sending = false;
  #next: Initiative | null = null;

  constructor(campaignId: string) {
    this.campaignId = campaignId;
  }

  /** Reads it and follows it; returns how to stop. */
  start(): () => void {
    let on = true;
    campaignRepo
      .initiative(this.campaignId)
      .then((i) => {
        if (!on || this.#sending) return;
        this.state = i;
        this.#confirmed = i;
      })
      .catch(() => {})
      .finally(() => (this.ready = true));
    const stop = campaignRepo.followInitiative(this.campaignId, (i) => {
      // campaign_state changes for other reasons too (the music, database/0025's counters).
      if (JSON.stringify(i) === JSON.stringify(this.#confirmed)) return;
      this.#confirmed = i;
      if (on && !this.#sending) this.state = i;
    });
    return () => {
      on = false;
      stop();
    };
  }

  /** The DM changes the order (shown at once; put back if it doesn't save). */
  async save(next: Initiative): Promise<void> {
    this.state = next;
    this.#next = next;
    if (this.#sending) return;
    this.#sending = true;
    try {
      while (this.#next) {
        const sending = this.#next;
        this.#next = null;
        await campaignRepo.saveInitiative(this.campaignId, sending);
        this.#confirmed = sending;
      }
    } catch (e) {
      this.#next = null;
      this.state = this.#confirmed;
      throw e;
    } finally {
      this.#sending = false;
    }
  }
  async patch(part: Partial<Initiative>): Promise<void> {
    await this.save({ ...this.state, ...part });
  }

  /** Ties settled by hand: the DM saves them with the order, a player through database/0022. */
  async settle(ties: Record<string, number>, asDm: boolean): Promise<void> {
    if (asDm) return this.patch({ ties: { ...this.state.ties, ...ties } });
    const before = this.#confirmed;
    this.state = { ...this.state, ties: { ...this.state.ties, ...ties } };
    try {
      this.state = this.#confirmed = await campaignRepo.settleTies(this.campaignId, ties);
    } catch (e) {
      this.state = before;
      throw e;
    }
  }

  /** A player's own character's number (the DM's page writes it into the order instead). */
  async setMine(sheetId: string, value: number | null): Promise<void> {
    const before = this.#confirmed;
    const pcs = { ...this.state.pcs };
    if (value === null) delete pcs[sheetId];
    else pcs[sheetId] = value;
    this.state = { ...this.state, pcs };
    try {
      this.state = this.#confirmed = await campaignRepo.setMyInitiative(sheetId, value);
    } catch (e) {
      this.state = before;
      throw e;
    }
  }
}
