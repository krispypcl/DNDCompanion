/**
 * The initiative order, live (database/0019, campaign_state.initiative): read
 * once, then followed as it changes, on the campaign page, a character's
 * sheet and in Owlbear alike. The DM saves the whole order; a player puts in
 * their own character's number.
 */
import { campaignRepo, NO_INITIATIVE, type Initiative } from '$lib/data/campaigns';

export class LiveInitiative {
  state = $state<Initiative>(NO_INITIATIVE);
  /** Read at least once. */
  ready = $state(false);
  readonly campaignId: string;

  constructor(campaignId: string) {
    this.campaignId = campaignId;
  }

  /** Reads it and follows it; returns how to stop. */
  start(): () => void {
    let on = true;
    campaignRepo
      .initiative(this.campaignId)
      .then((i) => {
        if (on) this.state = i;
      })
      .catch(() => {})
      .finally(() => (this.ready = true));
    const stop = campaignRepo.followInitiative(this.campaignId, (i) => {
      if (on) this.state = i;
    });
    return () => {
      on = false;
      stop();
    };
  }

  /** The DM changes the order (shown at once; put back if it doesn't save). */
  async save(next: Initiative): Promise<void> {
    const before = this.state;
    this.state = next;
    try {
      await campaignRepo.saveInitiative(this.campaignId, next);
    } catch (e) {
      this.state = before;
      throw e;
    }
  }
  async patch(part: Partial<Initiative>): Promise<void> {
    await this.save({ ...this.state, ...part });
  }

  /** A player's own character's number (the DM's page writes it into the order instead). */
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
