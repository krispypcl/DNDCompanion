import { describe, expect, it } from 'vitest';
import { CampaignError, campaignMessage, inviteCode } from '$lib/data/campaigns';

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
