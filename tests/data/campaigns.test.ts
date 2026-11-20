import { describe, expect, it } from 'vitest';
import { CampaignError, campaignMessage, inviteCode, lastSessionOf, setNextSession } from '#lib/data/campaigns.ts';

describe('campaign helpers', () => {
  it('reads an invite pasted as a code or as the whole link', () => {
    expect(inviteCode('AB12cd34EF')).toBe('ab12cd34ef');
    expect(inviteCode(' https://krispypcl.github.io/DNDCompanion/join?code=ab12cd34ef ')).toBe('ab12cd34ef');
    expect(inviteCode('')).toBe('');
  });
  it('shows its own refusals as they are, and anything else kindly', () => {
    expect(campaignMessage(new CampaignError('Only the DM can do that!'), 'x')).toBe('Only the DM can do that!');
    expect(campaignMessage(new Error('weird'), 'Fallback!')).toBe('Fallback!');
  });
});

describe('last session', () => {
  const now = new Date('2026-11-16T12:00:00Z');
  it('keeps a session that has started when the next is set', () => {
    expect(setNextSession({ nextSession: '2026-11-14T12:00:00Z' }, '2026-11-21T12:00:00Z', now))
      .toEqual({ nextSession: '2026-11-21T12:00:00Z', lastSession: '2026-11-14T12:00:00Z' });
    // Moving a session that hasn't happened keeps the last one as it was.
    expect(setNextSession({ nextSession: '2026-11-20T12:00:00Z', lastSession: '2026-11-14T12:00:00Z' }, '2026-11-21T12:00:00Z', now))
      .toEqual({ nextSession: '2026-11-21T12:00:00Z' });
  });
  it('is the next session once it has started, else the one kept', () => {
    expect(lastSessionOf({ nextSession: '2026-11-15T12:00:00Z', lastSession: '2026-11-08T12:00:00Z' }, now)).toBe('2026-11-15T12:00:00Z');
    expect(lastSessionOf({ nextSession: '2026-11-21T12:00:00Z', lastSession: '2026-11-14T12:00:00Z' }, now)).toBe('2026-11-14T12:00:00Z');
    expect(lastSessionOf({ nextSession: '2026-11-21T12:00:00Z' }, now)).toBeNull();
    expect(lastSessionOf(undefined, now)).toBeNull();
  });
});

describe('readInitiative', async () => {
  const { readInitiative, NO_INITIATIVE } = await import('#lib/data/campaigns.ts');
  it('reads nothing as no fight', () => {
    expect(readInitiative(null)).toEqual(NO_INITIATIVE);
    expect(readInitiative('x')).toEqual(NO_INITIATIVE);
  });
  it('keeps good parts and drops bad ones', () => {
    expect(readInitiative({ pcs: { a: 12, b: 'x', c: Number.NaN }, turn: 'pc:a', round: 2.7, asking: 'yes', ties: { 'pc:a': 2, 'cr:b': 'x' } }))
      .toEqual({ pcs: { a: 12 }, turn: 'pc:a', round: 2, asking: false, ties: { 'pc:a': 2 } });
    expect(readInitiative({ turn: '', round: -1, asking: true })).toEqual({ pcs: {}, turn: null, round: 0, asking: true, ties: {} });
  });
});
