import { afterEach, describe, expect, it, vi } from 'vitest';
import { feel } from '#lib/haptics.ts';

describe('haptics (a phone buzzes for the player’s own moments)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const device = (coarse: boolean) => {
    const buzzed: unknown[] = [];
    vi.stubGlobal('navigator', { vibrate: (p: unknown) => (buzzed.push(p), true) });
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: coarse && q.includes('coarse') }));
    return buzzed;
  };

  it('buzzes on a touch screen, a blow as hard as it was', () => {
    const buzzed = device(true);
    feel('crit');
    feel('hit', 0);
    feel('hit', 1);
    expect(buzzed[0]).toEqual([20, 40, 20, 40, 45]);
    expect(buzzed[1]).toBe(12);
    expect(buzzed[2]).toBe(60);
  });

  it('stays still with a mouse, or where the browser cannot buzz', () => {
    const buzzed = device(false);
    feel('crit');
    expect(buzzed).toEqual([]);
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(() => feel('crit')).not.toThrow();
  });
});
