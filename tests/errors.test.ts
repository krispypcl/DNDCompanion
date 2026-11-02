import { describe, expect, it } from 'vitest';
import { friendlyError } from '$lib/errors';

describe('friendlyError', () => {
  it('turns what Supabase and the browser say into something friendlier', () => {
    expect(friendlyError(new Error('Invalid login credentials'), 'x')).toMatch(/don't match!/);
    expect(friendlyError(new TypeError('Failed to fetch'), 'x')).toMatch(/connection/);
  });
  it('falls back to the caller’s own message', () => {
    expect(friendlyError(new Error('something odd'), 'That fizzled!')).toBe('That fizzled!');
    expect(friendlyError(undefined, 'That fizzled!')).toBe('That fizzled!');
  });
});
