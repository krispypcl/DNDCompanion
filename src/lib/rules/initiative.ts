/**
 * The initiative order on the campaign page: the players' characters and
 * the DM's monsters and NPCs, highest first, and whose turn it is. Only
 * those with an initiative take turns; the rest wait at the end.
 */
import { fairRng, type Rng } from './dice';

export type Combatant = {
  /** "pc:<sheet id>" or "cr:<creature id>". */
  key: string;
  name: string;
  value: number | null;
  /** Breaks a tie: the higher Dexterity modifier goes first. */
  dex?: number;
  side: 'pc' | 'creature';
};
export type Turn = { turn: string | null; round: number };
/** A line in the tracker: hidden from the players (the DM's view), or the viewer's own character. */
export type InitiativeRow = Combatant & { hidden?: boolean; mine?: boolean };

export function ordered(list: Combatant[]): Combatant[] {
  return [...list].sort((a, b) => {
    if (a.value === null && b.value === null) return a.name.localeCompare(b.name);
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value || (b.dex ?? 0) - (a.dex ?? 0) || a.name.localeCompare(b.name);
  });
}

const inPlay = (list: Combatant[]) => ordered(list).filter((c) => c.value !== null);

/** The first turn of round 1, or nothing when nobody has rolled. */
export function start(list: Combatant[]): Turn {
  const first = inPlay(list)[0];
  return { turn: first?.key ?? null, round: first ? 1 : 0 };
}

/** The next one in the order; past the last, the top of the next round. */
export function next(list: Combatant[], at: Turn): Turn {
  const order = inPlay(list);
  if (!order.length) return { turn: null, round: 0 };
  const i = order.findIndex((c) => c.key === at.turn);
  if (i < 0) return { turn: order[0].key, round: Math.max(1, at.round) };
  return i === order.length - 1 ? { turn: order[0].key, round: at.round + 1 } : { turn: order[i + 1].key, round: at.round };
}

/** One back; before the first, the last of the round before (never before round 1). */
export function previous(list: Combatant[], at: Turn): Turn {
  const order = inPlay(list);
  if (!order.length) return { turn: null, round: 0 };
  const i = order.findIndex((c) => c.key === at.turn);
  if (i < 0) return { turn: order[0].key, round: Math.max(1, at.round) };
  if (i > 0) return { turn: order[i - 1].key, round: at.round };
  return at.round > 1 ? { turn: order[order.length - 1].key, round: at.round - 1 } : at;
}

/** A d20 plus what it adds to initiative; with advantage (an item or feature), the higher of two d20s. */
export const rollInitiative = (bonus: number, die: Rng = fairRng, advantage = false) =>
  (advantage ? Math.max(die(20), die(20)) : die(20)) + bonus;
