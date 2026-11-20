import { describe, expect, it } from 'vitest';
import { countdown, friendlyDate, latest, numericDate, sessionWhen } from '#lib/rules/dates.ts';

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

describe('sessionWhen', () => {
  const now = new Date('2026-11-16T15:00:00');
  it('says how far off the next session is', () => {
    expect(sessionWhen('2026-11-16T19:00:00', now)?.until).toBe('today');
    expect(sessionWhen('2026-11-17T19:00:00', now)?.until).toBe('tomorrow');
    expect(sessionWhen('2026-11-21T19:00:00', now)?.until).toBe('in 5 days');
  });
  it('is on now for its first hours, then past', () => {
    expect(sessionWhen('2026-11-16T13:00:00', now)).toMatchObject({ until: 'now', past: false });
    expect(sessionWhen('2026-11-15T19:00:00', now)).toMatchObject({ past: true });
    expect(sessionWhen('', now)).toBeNull();
    expect(sessionWhen('soon', now)).toBeNull();
  });
});

describe('countdown', () => {
  const at = new Date(2026, 10, 16, 18, 0);
  it('counts minutes, then hours and minutes, then days', () => {
    expect(countdown('2026-11-16T18:45:00', at)).toBe('in 45 min');
    expect(countdown('2026-11-16T20:15:00', at)).toBe('in 2 h 15 min');
    expect(countdown('2026-11-16T21:00:00', at)).toBe('in 3 h');
    expect(countdown('2026-11-18T19:00:00', at)).toBe('in 2 days');
  });
  it('is now while it runs, and nothing once past', () => {
    expect(countdown('2026-11-16T17:00:00', at)).toBe('now');
    expect(countdown('2026-11-15T10:00:00', at)).toBeNull();
    expect(countdown(null, at)).toBeNull();
  });
});
