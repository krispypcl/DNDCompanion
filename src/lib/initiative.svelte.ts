/**
 * The initiative order, live (database/0019, campaign_state.initiative): read
 * once, then followed as it changes, on the campaign page, a character's
 * sheet and in Owlbear alike. The DM saves the whole order; a player puts in
 * their own character's number.
 *
 * Before 0019 the order lived in the campaign's details, which only the DM
 * could write and the players saw when their page read the campaign again:
 * `legacy` keeps that working until it has run. TODO: drop once 0019 has run.
 */
import { campaignRepo, NO_INITIATIVE, readInitiative, type Initiative } from '$lib/data/campaigns';

export class LiveInitiative {
  state = $state<Initiative>(NO_INITIATIVE);
  /** The database is from before 0019 (see above). */
  legacy = $state(false);
  /** Read at least once. */
  ready = $state(false);
  readonly campaignId: string;
  #fromDetails: () => unknown;
  #toDetails: ((i: Initiative) => Promise<void>) | null;

  constructor(campaignId: string, legacy?: { read: () => unknown; save?: (i: Initiative) => Promise<void> }) {
    this.campaignId = campaignId;
    this.#fromDetails = legacy?.read ?? (() => undefined);
    this.#toDetails = legacy?.save ?? null;
  }

  /** Reads it and follows it; returns how to stop. */
  start(): () => void {
    let on = true;
    campaignRepo
      .initiative(this.campaignId)
      .then((i) => {
        if (!on) return;
        if (i === null) {
          this.legacy = true;
          this.state = readInitiative(this.#fromDetails());
        } else this.state = i;
      })
      .catch(() => {})
      .finally(() => (this.ready = true));
    const stop = campaignRepo.followInitiative(this.campaignId, (i) => {
      if (on && !this.legacy) this.state = i;
    });
    return () => {
      on = false;
      stop();
    };
  }

  /** Before 0019: the campaign was read again, with the order in its details. */
  syncLegacy() {
    if (this.legacy) this.state = readInitiative(this.#fromDetails());
  }

  /** The DM changes the order (shown at once; put back if it doesn't save). */
  async save(next: Initiative): Promise<void> {
    const before = this.state;
    this.state = next;
    try {
      if (this.legacy) await this.#toDetails?.(next);
      else await campaignRepo.saveInitiative(this.campaignId, next);
    } catch (e) {
      this.state = before;
      throw e;
    }
  }
  async patch(part: Partial<Initiative>): Promise<void> {
    await this.save({ ...this.state, ...part });
  }

  /** A player's own character's number; the DM's own page writes it into the order instead. */
  async setMine(sheetId: string, value: number | null): Promise<void> {
    const before = this.state;
    const pcs = { ...this.state.pcs };
    if (value === null) delete pcs[sheetId];
    else pcs[sheetId] = value;
    this.state = { ...this.state, pcs };
    try {
      this.state = await campaignRepo.setMyInitiative(sheetId, value);
    } catch (e) {
      this.state = before;
      throw e;
    }
  }
}
