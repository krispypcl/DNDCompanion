import { describe, expect, it } from 'vitest';
import { CampaignError, campaignMessage, inviteCode, isMissingFunction } from '$lib/data/campaigns';

describe('campaign helpers', () => {
  it('reads an invite pasted as a code or as the whole link', () => {
    expect(inviteCode('AB12cd34EF')).toBe('ab12cd34ef');
    expect(inviteCode(' https://krispypcl.github.io/DNDCompanion/join?code=ab12cd34ef ')).toBe('ab12cd34ef');
    expect(inviteCode('')).toBe('');
  });
  it('knows a database without campaigns yet', () => {
    expect(isMissingFunction({ code: 'PGRST202' })).toBe(true);
    expect(isMissingFunction({ message: 'Could not find the function public.join_campaign' })).toBe(true);
    expect(isMissingFunction({ code: '42501' })).toBe(false);
  });
  it('shows its own refusals as they are, and anything else kindly', () => {
    expect(campaignMessage(new CampaignError('Only the DM can do that!'), 'x')).toBe('Only the DM can do that!');
    expect(campaignMessage(new Error('weird'), 'Fallback!')).toBe('Fallback!');
  });
});
