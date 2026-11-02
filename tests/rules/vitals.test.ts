import { describe, expect, it } from 'vitest';
import { applyDamage, applyHealing, isDead, setDeathSave, withVitals } from '$lib/rules/hp';
import { emptyState, type State } from '$lib/types';

const at = (hp: number, over: Partial<State> = {}): State => ({ ...emptyState(), hpCurrent: hp, ...over });
const step = (before: State, after: State) => withVitals(before, after, 20);

describe('withVitals', () => {
  it('adds Incapacitated on dropping to 0, once', () => {
    const before = at(5, { conditions: ['Prone'] });
    const down = step(before, applyDamage(before, 9, 20));
    expect(down.conditions).toEqual(['Prone', 'Incapacitated']);
    expect(step(down, applyDamage(down, 3, 20)).conditions).toEqual(['Prone', 'Incapacitated']);
  });

  it('takes Incapacitated and Dead away on coming back up', () => {
    const before = at(0, { conditions: ['Incapacitated', 'Dead', 'Prone'] });
    expect(step(before, applyHealing(before, 4, 20)).conditions).toEqual(['Prone']);
  });

  it('brings a third success back to 1 hit point', () => {
    const before = at(0, { conditions: ['Incapacitated'], deathSaves: { successes: 2, failures: 1 } });
    const after = step(before, setDeathSave(before, 'successes', 3));
    expect(after.hpCurrent).toBe(1);
    expect(after.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(after.conditions).toEqual([]);
  });

  it('marks a third failure Dead, and takes it back with the failure', () => {
    const before = at(0, { conditions: ['Incapacitated'], deathSaves: { successes: 1, failures: 2 } });
    const dead = step(before, setDeathSave(before, 'failures', 3));
    expect(dead.conditions).toEqual(['Incapacitated', 'Dead']);
    expect(isDead(dead)).toBe(true);
    const undone = step(dead, setDeathSave(dead, 'failures', 2));
    expect(undone.conditions).toEqual(['Incapacitated']);
  });

  it('decides nothing without a maximum', () => {
    const before = at(3);
    expect(withVitals(before, at(0), 0).conditions).toEqual([]);
  });
});
