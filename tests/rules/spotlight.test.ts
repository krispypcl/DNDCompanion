import { describe, expect, it } from 'vitest';
import { entryUrl, matchRank, search, type IndexRow } from '#lib/rules/spotlight.ts';
import { peekTarget } from '#lib/rules/peek.ts';

const rows: IndexRow[] = [
  ['Fireball', 's', 'PHB', 'Level 3 Evocation'],
  ['Fireball', 's', 'XPHB', 'Level 3 Evocation'],
  ['Delayed Blast Fireball', 's', 'XPHB', 'Level 7 Evocation'],
  ['Fire Bolt', 's', 'XPHB', 'Evocation Cantrip'],
  ['Goblin', 'm', 'MM', 'CR 1/4 Humanoid'],
  ['Goblin Boss', 'm', 'XMM', 'CR 1 Fey'],
  ['Goblin Warrior', 'm', 'XMM', 'CR 1/4 Fey'],
  ['Hobgoblin Captain', 'm', 'XMM', 'CR 3 Fey']
];

describe('the search', () => {
  it('ranks the same name, then names starting with it, then words, then anywhere', () => {
    expect(matchRank('Fireball', 'fireball')).toBe(0);
    expect(matchRank('Fire Bolt', 'fire')).toBe(1);
    expect(matchRank('Delayed Blast Fireball', 'fire')).toBe(2);
    expect(matchRank('Hobgoblin Captain', 'goblin')).toBe(3);
    expect(matchRank('Goblin', 'x')).toBe(-1);
  });
  it('gives one row an entry, from the newest book, best first', () => {
    const hits = search(rows, 'fireball');
    expect(hits.map((h) => `${h.name} ${h.source}`)).toEqual(['Fireball XPHB', 'Delayed Blast Fireball XPHB']);
    expect(search(rows, 'goblin').map((h) => h.name)).toEqual(['Goblin', 'Goblin Boss', 'Goblin Warrior', 'Hobgoblin Captain']);
    expect(search(rows, 'gob', 30, ['s'])).toEqual([]);
    expect(search(rows, 'g')).toEqual([]);
  });
  it('opens each at its page, which the pop-ups read', () => {
    expect(entryUrl('Goblin Boss', 'm', 'XMM')).toBe('https://5e.tools/bestiary.html#goblin%20boss_xmm');
    expect(peekTarget(entryUrl('Fireball', 's', 'XPHB'))).toEqual({ page: 'spells', name: 'fireball', source: 'xphb' });
  });
});
