import { describe, expect, it } from 'vitest';
import { friendlyDate, latest, numericDate } from '$lib/rules/dates';

const now = new Date(2026, 10, 2, 9, 0);

describe('friendlyDate', () => {
  it('says today and yesterday', () => {
    expect(friendlyDate(new Date(2026, 10, 2, 1).toISOString(), now)).toBe('today');
    expect(friendlyDate(new Date(2026, 10, 1, 23).toISOString(), now)).toBe('yesterday');
  });
  it('gives the day, and the year only when it is another year', () => {
    expect(friendlyDate(new Date(2026, 9, 28).toISOString(), now)).not.toMatch(/2026/);
    expect(friendlyDate(new Date(2025, 9, 28).toISOString(), now)).toMatch(/2025/);
  });
  it('says nothing for nothing', () => {
    expect(friendlyDate(null, now)).toBe('');
    expect(friendlyDate('nonsense', now)).toBe('');
  });
});

describe('latest', () => {
  it('picks the later stamp and ignores blanks', () => {
    expect(latest('2026-10-01T00:00:00Z', null, '2026-11-01T00:00:00Z', 'x')).toBe('2026-11-01T00:00:00Z');
    expect(latest(null, undefined)).toBeNull();
  });
});

describe('numericDate', () => {
  it('writes the day month first, with leading zeros', () => {
    expect(numericDate('2026-03-05T12:00:00')).toBe('03/05/2026');
    expect(numericDate('2026-11-16T09:30:00')).toBe('11/16/2026');
    expect(numericDate('')).toBe('');
    expect(numericDate('nonsense')).toBe('');
  });
});
