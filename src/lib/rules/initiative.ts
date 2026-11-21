/**
 * The initiative order on the campaign page: the players' characters and
 * the DM's monsters and NPCs, highest first, and whose turn it is. Only
 * those with an initiative take turns; the rest wait at the end.
 *
 * A tie goes to the higher Dexterity modifier until someone settles it by
 * dragging: the DM moves a monster or NPC among those it ties with
 * (characters included), and a player moves their own character among the
 * tied characters, which keep the places they hold among the creatures.
 * What was settled is a score per combatant (database/0022, initiative.ties)
 * that stands in for its Dexterity, so the order stays one sort.
 */
import { fairRng, type Rng } from './dice.ts';

export type Combatant = {
  /** "pc:<sheet id>" or "cr:<creature id>". */
  key: string;
  name: string;
  value: number | null;
  /** Breaks a tie: the higher Dexterity modifier goes first. */
  dex?: number;
  /** A tie settled by hand: stands in for dex (higher first). */
  tie?: number;
  side: 'pc' | 'creature';
};
export type Turn = { turn: string | null; round: number };
/** A line in the tracker: hidden from the players (the DM's view), or the viewer's own character. */
export type InitiativeRow = Combatant & { hidden?: boolean; mine?: boolean };

export function ordered<T extends Combatant>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.value === null && b.value === null) return a.name.localeCompare(b.name);
    if (a.value === null) return 1;
    if (b.value === null) return -1;
    return b.value - a.value || score(b) - score(a) || a.name.localeCompare(b.name);
  });
}
const score = (c: Combatant) => c.tie ?? c.dex ?? 0;

/** Who shares this one's number, in the order shown (itself included). */
function tiedGroup<T extends Combatant>(order: T[], key: string): T[] {
  const me = order.find((c) => c.key === key);
  if (!me || me.value === null) return [];
  return order.filter((c) => c.value === me.value);
}

/** Whether this one can be dragged to settle a tie: the DM's creatures, a player's own character among characters. */
export function canSettle(list: InitiativeRow[], key: string, isDm: boolean): boolean {
  const group = tiedGroup(ordered(list), key);
  const me = group.find((c) => c.key === key);
  if (!me || group.length < 2) return false;
  if (isDm) return me.side === 'creature';
  return Boolean(me.mine) && me.side === 'pc' && group.filter((c) => c.side === 'pc').length > 1;
}

/**
 * The order a drag would make, or null when it isn't allowed: a tie is only
 * settled within itself, and a player's characters swap places among the
 * characters' places, leaving each creature where it is.
 */
export function settleOrder(list: InitiativeRow[], key: string, proposed: string[], isDm: boolean): string[] | null {
  const shown = ordered(list);
  const now = shown.map((c) => c.key);
  const group = new Set(tiedGroup(shown, key).map((c) => c.key));
  if (proposed.length !== now.length) return null;
  // Nothing outside the tie moves.
  for (let i = 0; i < now.length; i++) if (!group.has(now[i]) && proposed[i] !== now[i]) return null;
  if (isDm) return proposed;
  const pc = (k: string) => k.startsWith('pc:');
  const pcs = proposed.filter((k) => group.has(k) && pc(k));
  const out = [...now];
  let n = 0;
  for (let i = 0; i < out.length; i++) if (group.has(out[i]) && pc(out[i])) out[i] = pcs[n++];
  return out;
}

/**
 * The scores to keep for a settled tie. The DM sees everyone, so the whole
 * tie is numbered afresh; a player's characters take the scores of the
 * places they moved into, so the creatures between them stay put.
 */
export function settleScores(list: InitiativeRow[], key: string, order: string[], isDm: boolean): Record<string, number> {
  const group = tiedGroup(ordered(list), key);
  const keys = new Set(group.map((c) => c.key));
  const next = order.filter((k) => keys.has(k));
  const out: Record<string, number> = {};
  if (isDm) {
    next.forEach((k, i) => (out[k] = next.length - i));
    return out;
  }
  const places = group.filter((c) => c.side === 'pc').map(score);
  let last = Infinity;
  next.filter((k) => k.startsWith('pc:')).forEach((k, i) => {
    last = Math.min(places[i], last - 0.001);
    out[k] = Math.round(last * 1000) / 1000;
  });
  return out;
}

/**
 * The ties not yet numbered (one of them without a score), numbered as they
 * stand; null when there are none. The DM's page keeps them so, since the
 * players can't see a creature's Dexterity and would order a fresh tie their
 * own way.
 */
export function unsettled(list: Combatant[]): Record<string, number> | null {
  const order = ordered(list).filter((c) => c.value !== null);
  const out: Record<string, number> = {};
  let any = false;
  for (const value of new Set(order.map((c) => c.value))) {
    const group = order.filter((c) => c.value === value);
    if (group.length < 2 || group.every((c) => c.tie !== undefined)) continue;
    any = true;
    group.forEach((c, i) => (out[c.key] = group.length - i));
  }
  return any ? out : null;
}

/** Every tie as it stands, numbered, so every page shows the same order (kept when the fight starts). */
export function settleAll(list: Combatant[]): Record<string, number> {
  const out: Record<string, number> = {};
  const order = ordered(list).filter((c) => c.value !== null);
  for (const c of order) {
    const group = order.filter((x) => x.value === c.value);
    if (group.length > 1) out[c.key] = group.length - group.indexOf(c);
  }
  return out;
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
