/**
 * Names the Owlbear Rodeo extension keeps its things under: in the room's and
 * items' metadata, and on the Supabase channel rolls travel on. Owlbear asks
 * for keys in reverse-domain form so extensions never collide.
 */
export const NS = 'com.dndcompanion';
/** Room metadata: the DND Companion links added to this room (RoomLinks). */
export const ROOM_KEY = `${NS}/room`;
/** Room metadata: the latest rolls made on the room's sheets (RollNote[]). */
export const ROLLS_KEY = `${NS}/rolls`;
/** Room metadata: the order the DM put the room's characters in (sheet ids). */
export const ORDER_KEY = `${NS}/order`;
/** A token's metadata: the sheet it stands for (TokenLink). */
export const SHEET_KEY = `${NS}/sheet`;
/** An attachment's metadata: what it shows, for which token (PartLink). */
export const PART_KEY = `${NS}/part`;

export type TokenLink = { id: string; portrait?: string };
export type PartKind = 'hp-back' | 'hp-fill' | 'hp-temp' | `cond-${number}`;
export type PartLink = { token: string; kind: PartKind };
