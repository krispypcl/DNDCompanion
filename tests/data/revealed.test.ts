import { describe, expect, it } from 'vitest';
import { asRevealed, type Creature } from '#lib/data/creatures.ts';

const beast = (over: Partial<Creature>): Creature => ({
  id: 'x', campaign_id: 'c', kind: 'monster', name: 'Goblin', hp_max: 20, hp_current: 20, hp_temp: 0, ac: 15, conditions: [], notes: 'secret',
  link: '', position: 0, initiative: null, visible: true, statblock: {}, portrait: '', condition_looks: {}, expression: 'Snarling',
  created_at: '', updated_at: '', ...over
});

describe('what the players see, on the DM page', () => {
  it('keeps only the revealed ones, as hurt as they look', () => {
    const seen = asRevealed([
      beast({ id: 'a', hp_current: 20 }),
      beast({ id: 'b', hp_current: 9 }),
      beast({ id: 'c', hp_current: 4 }),
      beast({ id: 'd', hp_current: 0 }),
      beast({ id: 'e', hp_max: null, hp_current: null }),
      beast({ id: 'f', visible: false })
    ]);
    expect(seen.map((c) => [c.id, c.vital])).toEqual([['a', 'healthy'], ['b', 'bloodied'], ['c', 'critical'], ['d', 'down'], ['e', 'unknown']]);
    expect(seen[0]).not.toHaveProperty('notes');
    expect(seen[0].expression).toBe('Snarling');
  });
});
