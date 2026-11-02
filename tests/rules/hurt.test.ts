import { describe, expect, it } from 'vitest';
import { hitSeverity, hurtLevel, vitalStatus } from '$lib/rules/hp';

describe('hurtLevel', () => {
  it('is nothing at half health or better', () => {
    expect(hurtLevel(44, 44)).toBe(0);
    expect(hurtLevel(22, 44)).toBe(0);
  });

  it('begins the moment it drops below half', () => {
    expect(hurtLevel(21, 44)).toBeGreaterThan(0);
  });

  it('grows as health falls, to one at zero', () => {
    const levels = [20, 15, 10, 5, 0].map((hp) => hurtLevel(hp, 44));
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels.at(-1)).toBe(1);
  });

  it('survives nonsense: no maximum, overheal, negative', () => {
    expect(hurtLevel(5, 0)).toBe(0);
    expect(hurtLevel(60, 44)).toBe(0);
    expect(hurtLevel(-4, 44)).toBe(1);
  });
});

describe('hitSeverity', () => {
  it('is nothing for no damage', () => {
    expect(hitSeverity(0, 44)).toBe(0);
    expect(hitSeverity(-3, 44)).toBe(0);
  });

  it('grows with the share of the maximum lost', () => {
    expect(hitSeverity(2, 44)).toBeLessThan(hitSeverity(10, 44));
    expect(hitSeverity(10, 44)).toBeLessThan(hitSeverity(20, 44));
  });

  it('is relative to the character, not absolute', () => {
    expect(hitSeverity(10, 200)).toBeLessThan(hitSeverity(10, 20));
  });

  it('tops out at one', () => {
    expect(hitSeverity(500, 44)).toBe(1);
    expect(hitSeverity(22, 44)).toBe(1);
  });

  it('copes with no maximum', () => {
    expect(hitSeverity(5, 0)).toBe(0);
  });
});

describe('vitalStatus', () => {
  it('names each band of health', () => {
    expect(vitalStatus(40, 40).label).toBe('Healthy');
    expect(vitalStatus(21, 40).label).toBe('Healthy');
    expect(vitalStatus(20, 40).label).toBe('Bloodied');
    expect(vitalStatus(10, 40).label).toBe('Critical');
    expect(vitalStatus(1, 40).label).toBe('Critical');
  });
  it('reads death saves at zero', () => {
    expect(vitalStatus(0, 40).label).toBe('Down');
    expect(vitalStatus(0, 40, { successes: 3, failures: 1 }).label).toBe('Stable');
    expect(vitalStatus(0, 40, { successes: 1, failures: 3 }).label).toBe('Dead');
  });
  it('has nothing to say about a sheet with no maximum yet', () => {
    expect(vitalStatus(0, 0).label).toBe('Healthy');
  });
});
