/**
 * Rolling spells. A spell's Roll is written like an attack's damage, with what
 * it gains for each slot level above its own after a slash:
 *
 *   8d6 fire +1d6/level        Fireball: 8d6, and 1d6 more per level above 3rd
 *   3d4+3 +1d4/lvl             Magic Missile (a dart per level, as 1d4+1 each)
 *   1d10 fire                  Fire Bolt: a cantrip, so it grows with the
 *                              character instead: 2d10 at 5th, 3d10 at 11th...
 */
import { DIE_SIDES, MAX_DICE, diceCount, parseRoll, type Pool, type Sides } from './dice';

/** "+1d6/level", "+1d6 per slot level", "+ 2d8 / lvl". */
const UPCAST = /\+\s*((?:\d*\s*d\s*\d+)(?:\s*[+-]\s*\d+)?)\s*(?:\/|per)\s*(?:slot\s*)?(?:lvl|level|slot)s?\b/i;

/** The base roll and, if written, what each level above adds. */
export function splitUpcast(text: unknown): { base: string; per: Pool | null } {
  const raw = String(text ?? '');
  const m = raw.match(UPCAST);
  if (!m) return { base: raw, per: null };
  return { base: raw.replace(m[0], ' ').trim(), per: parseRoll(m[1], 'damage') };
}

/** How many times a cantrip's dice are rolled at this character level. */
export function cantripTier(characterLevel: number): number {
  return 1 + (characterLevel >= 5 ? 1 : 0) + (characterLevel >= 11 ? 1 : 0) + (characterLevel >= 17 ? 1 : 0);
}

/** `pool` with `extra` added `times` times; null if that is too many dice. */
function addPool(pool: Pool, extra: Pool, times: number): Pool | null {
  if (times <= 0) return pool;
  const out: Pool = { dice: { ...pool.dice }, modifier: pool.modifier + extra.modifier * times, mode: pool.mode };
  for (const sides of DIE_SIDES) {
    const n = extra.dice[sides as Sides];
    if (n) out.dice[sides as Sides] = (out.dice[sides as Sides] ?? 0) + n * times;
  }
  return diceCount(out) > MAX_DICE ? null : out;
}

/** A cantrip's dice, multiplied for the character's level; its modifier is not. */
function scaleCantrip(pool: Pool, characterLevel: number): Pool | null {
  const tier = cantripTier(characterLevel);
  if (tier === 1) return pool;
  const out: Pool = { dice: {}, modifier: pool.modifier, mode: pool.mode };
  for (const sides of DIE_SIDES) {
    const n = pool.dice[sides as Sides];
    if (n) out.dice[sides as Sides] = n * tier;
  }
  return diceCount(out) > MAX_DICE ? null : out;
}

/**
 * The damage roll for a spell. `spellLevel` is the spell's own level (0 for a
 * cantrip, null when not written); `castAt` the slot it is cast with.
 */
export function spellDamage(text: unknown, spellLevel: number | null, castAt: number | null, characterLevel: number): Pool | null {
  const { base, per } = splitUpcast(text);
  const pool = parseRoll(base, 'damage');
  if (!pool) return null;
  if (spellLevel === 0) return scaleCantrip(pool, characterLevel);
  if (per && spellLevel !== null && castAt !== null && castAt > spellLevel) return addPool(pool, per, castAt - spellLevel);
  return pool;
}
