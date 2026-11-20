import { describe, expect, it } from 'vitest';
import { baseName, creatureUrl, damage, heal, hpNow, numberedNames } from '#lib/rules/creatures.ts';

const goblin = { hp_max: 7, hp_current: 7, hp_temp: 0 };

describe('creature hit points', () => {
  it('starts full when only the most is written', () => {
    expect(hpNow({ hp_max: 7, hp_current: null, hp_temp: 0 })).toBe(7);
    expect(hpNow({ hp_max: null, hp_current: null, hp_temp: 0 })).toBe(0);
  });
  it('takes damage from temporary hit points first, and stops at 0', () => {
    expect(damage({ ...goblin, hp_temp: 3 }, 5)).toEqual({ hp_temp: 0, hp_current: 5 });
    expect(damage(goblin, 20)).toEqual({ hp_temp: 0, hp_current: 0 });
  });
  it('heals up to the most it can have', () => {
    expect(heal({ ...goblin, hp_current: 2 }, 3)).toEqual({ hp_current: 5 });
    expect(heal({ ...goblin, hp_current: 2 }, 30)).toEqual({ hp_current: 7 });
    expect(heal({ hp_max: null, hp_current: 2, hp_temp: 0 }, 3)).toEqual({ hp_current: 5 });
  });
});

describe('creature names', () => {
  it('leaves one alone and numbers a group on from those already there', () => {
    expect(numberedNames('Goblin', 1, [])).toEqual(['Goblin']);
    expect(numberedNames('Goblin', 3, [])).toEqual(['Goblin 1', 'Goblin 2', 'Goblin 3']);
    expect(numberedNames('Goblin', 2, ['Goblin 1', 'Goblin 3', 'Wolf'])).toEqual(['Goblin 4', 'Goblin 5']);
    expect(numberedNames('goblin', 1, ['Goblin'])).toEqual(['goblin 1']);
  });
  it('reads a numbered name as its creature, and finds it on 5e.tools', () => {
    expect(baseName('Goblin 12')).toBe('Goblin');
    expect(creatureUrl('Goblin 2', '')).toBe('https://5e.tools/search.html?q=Goblin');
    expect(creatureUrl('Goblin', ' https://5e.tools/bestiary.html#goblin_xmm ')).toBe('https://5e.tools/bestiary.html#goblin_xmm');
  });
});
