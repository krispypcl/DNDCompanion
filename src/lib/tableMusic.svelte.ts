/**
 * The table's music, as one page sees it: what the DM's jukebox is doing
 * (database/0008, campaign_live) and whether the DM has the campaign open
 * anywhere (Realtime presence). Shared by the campaign page and the Owlbear
 * Rodeo room, so both hear the same thing.
 *
 * - `at` is moved onto this device's clock as it arrives, so following never
 *   depends on whose clock is right.
 * - The music only plays while a DM page is present: with the DM gone,
 *   players wait at 0:00 (`table`).
 * - A DM arriving to music nobody was leading finds it stopped at 0:00; their
 *   page waits for that to be settled (`settled`, at most 3.5 s) before
 *   showing a player that could start from a moment that no longer holds.
 */
import { supabase, isConfigured } from '$lib/supabase';
import { campaignRepo, type CampaignLive, type Playback } from '$lib/data/campaigns';

type Presence = Record<string, { dm?: boolean }[]>;

export class TableMusic {
  /** The DM's music as it stands (null: nothing chosen yet). */
  playback = $state<Playback | null>(null);
  /** Ticks whenever the DM makes a new invite. */
  inviteRev = $state(0);
  /** A DM page is open somewhere (this one included). */
  dmHere = $state(false);
  /** Presence has answered (or there is none to ask). */
  presenceKnown = $state(false);
  /** For a DM's page: whether their return has been settled. */
  settled = $state(false);

  readonly #id: string;
  readonly #key = Math.random().toString(36).slice(2);
  #dm = $state(false);
  #channel: ReturnType<typeof supabase.channel> | null = null;
  #subscribed = false;
  #trackedAs: boolean | null = null;
  #otherDm = false;
  #mineSeen = false;
  #liveRead = false;

  constructor(campaignId: string) {
    this.#id = campaignId;
  }

  /** What a player's page plays: the DM's music, or with the DM away, 0:00 and still. */
  get table(): Playback | null {
    const pb = this.playback;
    // Until presence has answered, the music is followed as it was saved.
    return this.#dm || !pb || !this.presenceKnown || this.dmHere ? pb : { ...pb, playing: false, t: 0 };
  }
  /** A player's page while no DM page is open. */
  get away(): boolean {
    return !this.#dm && this.presenceKnown && !this.dmHere;
  }
  /** Ready to show the player: at once for players, after settling for the DM. */
  get ready(): boolean {
    return !this.#dm || this.settled;
  }

  /** Whether this page is the DM's (known once the campaign and the session are). */
  setDm(dm: boolean) {
    if (this.#dm === dm) return;
    this.#dm = dm;
    this.#track();
    this.#settle();
  }

  /** The DM's music, told to the table (and shown here at once). */
  send(p: Playback) {
    this.playback = p;
    void campaignRepo.savePlayback(this.#id, p).catch(() => {});
  }

  #take(next: CampaignLive | null, updatedAt?: string) {
    if (next) this.inviteRev = next.invite_rev ?? 0;
    const pb = next?.playback ?? null;
    if (!pb) {
      this.playback = null;
      return;
    }
    // Arriving live: it happened just now. Fetched: when the database says.
    const at = updatedAt ? Math.min(Date.now(), Date.parse(updatedAt) || Date.now()) : Date.now();
    const was = this.playback;
    if (!was || pb.at !== was.at || pb.index !== was.index || pb.playing !== was.playing || pb.t !== was.t) {
      this.playback = { ...pb, at };
    }
  }

  #track() {
    if (!this.#subscribed || !this.#channel || this.#trackedAs === this.#dm) return;
    this.#trackedAs = this.#dm;
    void this.#channel.track({ dm: this.#dm });
  }

  #readPresence() {
    if (!this.#channel) return;
    const all = Object.entries(this.#channel.presenceState() as Presence);
    this.#otherDm = all.some(([k, list]) => k !== this.#key && list.some((p) => p.dm));
    this.#mineSeen = all.some(([k, list]) => k === this.#key && list.some((p) => p.dm));
    this.dmHere = this.#otherDm || this.#mineSeen;
    if (!this.#dm || this.#mineSeen) this.presenceKnown = true;
    this.#settle();
  }

  /** The DM is back, and no other page of theirs was leading: the music waits at 0:00 for their play. */
  #settle() {
    if (this.settled || !this.#dm || !this.#mineSeen || !this.#liveRead) return;
    const pb = this.playback;
    if (!this.#otherDm && pb?.playing) this.send({ ...pb, playing: false, t: 0, at: Date.now() });
    this.settled = true;
  }

  /** Reads the music and starts listening; returns the way to stop. */
  start(): () => void {
    const id = this.#id;
    campaignRepo
      .live(id)
      .then((now) => this.#take(now, now?.updated_at))
      .catch(() => {})
      .finally(() => {
        this.#liveRead = true;
        this.#settle();
      });
    // If presence never answers, the DM's page goes ahead anyway.
    const giveUp = setTimeout(() => (this.settled = true), 3500);
    const channel = isConfigured
      ? supabase
          .channel(`table-${id}`, { config: { presence: { key: this.#key } } })
          .on('presence', { event: 'sync' }, () => this.#readPresence())
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_live', filter: `campaign_id=eq.${id}` }, (payload) => {
            const row = payload.new as { playback?: Playback | Record<string, never>; invite_rev?: number };
            const pb = row.playback && 'index' in row.playback ? (row.playback as Playback) : null;
            // The DM's own page already shows what it just did.
            if (this.#dm && pb && this.playback && pb.at === this.playback.at) {
              this.inviteRev = row.invite_rev ?? 0;
              return;
            }
            this.#take({ playback: pb, invite_rev: row.invite_rev ?? 0 });
          })
          .subscribe((status) => {
            this.#subscribed = status === 'SUBSCRIBED';
            if (this.#subscribed) {
              this.#trackedAs = null;
              this.#track();
            }
          })
      : null;
    this.#channel = channel;
    // Without Realtime there is no telling who is here: the music just follows.
    if (!channel) {
      this.dmHere = true;
      this.presenceKnown = true;
    }
    return () => {
      clearTimeout(giveUp);
      this.#channel = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }
}
