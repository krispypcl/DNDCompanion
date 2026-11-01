/**
 * Rolling dice: a pool of dice, a flat modifier, and advantage or
 * disadvantage, which applies to the d20s in the pool — each is rolled twice
 * and the higher (or lower) kept.
 *
 * Randomness comes from the browser's cryptographic generator, with
 * rejection sampling so every face is exactly as likely as every other.
 */

export const DIE_SIDES = [4, 6, 8, 10, 12, 20, 100] as const;
export type Sides = (typeof DIE_SIDES)[number];
export type Mode = 'normal' | 'advantage' | 'disadvantage';

export type Pool = { dice: Partial<Record<Sides, number>>; modifier: number; mode: Mode };

export type DieResult = {
  sides: Sides;
  /** The face that counts. */
  value: number;
  /** With advantage or disadvantage, the d20 that was rolled and dropped. */
  dropped?: number;
};

export type Roll = { pool: Pool; dice: DieResult[]; total: number; formula: string; at: number };

export type Rng = (sides: number) => number;

/** A fair 1..sides from crypto, falling back to Math.random where there is none. */
export const fairRng: Rng = (sides) => {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) return 1 + Math.floor(Math.random() * sides);
  const limit = Math.floor(0x1_0000_0000 / sides) * sides;
  const buf = new Uint32Array(1);
  do c.getRandomValues(buf);
  while (buf[0] >= limit);
  return 1 + (buf[0] % sides);
};

export const MAX_DICE = 50;

export function diceCount(pool: Pool): number {
  return DIE_SIDES.reduce((n, s) => n + (pool.dice[s] ?? 0), 0);
}

export function hasD20(pool: Pool): boolean {
  return (pool.dice[20] ?? 0) > 0;
}

export function addDie(pool: Pool, sides: Sides, by = 1): Pool {
  const now = pool.dice[sides] ?? 0;
  const next = Math.max(0, now + by);
  if (by > 0 && diceCount(pool) + by > MAX_DICE) return pool;
  const dice = { ...pool.dice, [sides]: next };
  if (next === 0) delete dice[sides];
  return { ...pool, dice };
}

/** "2d6 + 1d20 + 3, advantage" — biggest dice first, as a table says it. */
export function formula(pool: Pool): string {
  const parts = [...DIE_SIDES]
    .reverse()
    .filter((s) => (pool.dice[s] ?? 0) > 0)
    .map((s) => `${pool.dice[s]}d${s}`);
  let text = parts.join(' + ');
  if (pool.modifier) text += `${text ? ' ' : ''}${pool.modifier > 0 ? '+' : '−'} ${Math.abs(pool.modifier)}`;
  if (!text) return '';
  if (pool.mode !== 'normal' && hasD20(pool)) text += pool.mode === 'advantage' ? ', advantage' : ', disadvantage';
  return text;
}

export function roll(pool: Pool, rng: Rng = fairRng, now = Date.now()): Roll {
  const dice: DieResult[] = [];
  for (const sides of [...DIE_SIDES].reverse()) {
    for (let i = 0; i < (pool.dice[sides] ?? 0); i++) {
      if (sides === 20 && pool.mode !== 'normal') {
        const a = rng(20);
        const b = rng(20);
        const keep = pool.mode === 'advantage' ? Math.max(a, b) : Math.min(a, b);
        dice.push({ sides, value: keep, dropped: keep === a ? b : a });
      } else {
        dice.push({ sides, value: rng(sides) });
      }
    }
  }
  const total = dice.reduce((t, d) => t + d.value, 0) + pool.modifier;
  return { pool, dice, total, formula: formula(pool), at: now };
}
