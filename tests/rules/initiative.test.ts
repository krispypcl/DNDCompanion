import { describe, expect, it } from 'vitest';
import { next, ordered, previous, rollInitiative, start, type Combatant } from '$lib/rules/initiative';

const c = (key: string, value: number | null, dex = 0): Combatant => ({ key, name: key, value, dex, side: key.startsWith('pc') ? 'pc' : 'creature' });
const list = [c('cr:goblin', 12, 2), c('pc:loka', 17), c('pc:nyx', 12, 3), c('cr:boss', null)];

describe('initiative', () => {
  it('orders highest first, Dexterity breaking ties, the unrolled last', () => {
    expect(ordered(list).map((x) => x.key)).toEqual(['pc:loka', 'pc:nyx', 'cr:goblin', 'cr:boss']);
  });
  it('starts at the top of round 1 and goes round', () => {
    let t = start(list);
    expect(t).toEqual({ turn: 'pc:loka', round: 1 });
    t = next(list, t);
    t = next(list, t);
    expect(t).toEqual({ turn: 'cr:goblin', round: 1 });
    t = next(list, t);
    expect(t).toEqual({ turn: 'pc:loka', round: 2 });
    expect(previous(list, t)).toEqual({ turn: 'cr:goblin', round: 1 });
    expect(previous(list, { turn: 'pc:loka', round: 1 })).toEqual({ turn: 'pc:loka', round: 1 });
  });
  it('has no turns while nobody has rolled', () => {
    expect(start([c('cr:boss', null)])).toEqual({ turn: null, round: 0 });
  });
  it('rolls a d20 and adds the bonus', () => {
    expect(rollInitiative(3, () => 11)).toBe(14);
  });
});
