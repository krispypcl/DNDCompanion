/**
 * Names the Owlbear Rodeo extension keeps its things under: in the room's and
 * items' metadata, and in the popovers it opens. Owlbear asks
 * for keys in reverse-domain form so extensions never collide.
 */
export const NS = 'com.dndcompanion';
/** Room metadata: the room's campaign (links.ts roomValue). */
export const ROOM_KEY = `${NS}/room`;
/** Room metadata of old: a log of the latest rolls, cleared once a room is opened. */
export const OLD_ROLLS_KEY = `${NS}/rolls`;
/** Room metadata: the order the DM put the room's characters in (sheet ids). */
export const ORDER_KEY = `${NS}/order`;
/** A token's metadata: the sheet it stands for (TokenLink). */
export const SHEET_KEY = `${NS}/sheet`;
/** A token's metadata: the DM's monster or NPC it stands for (CreatureLink). */
export const CREATURE_KEY = `${NS}/creature`;
/** An attachment's metadata: what it shows, for which token (PartLink). */
export const PART_KEY = `${NS}/part`;

export type TokenLink = { id: string; portrait?: string };
export type CreatureLink = { id: string; campaign: string };
export type PartKind = 'hp-back' | 'hp-fill' | 'hp-temp' | `cond-${number}`;
export type PartLink = { token: string; kind: PartKind };
