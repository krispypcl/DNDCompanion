import { describe, expect, it } from 'vitest';
import { friendlyError } from '#lib/errors.ts';

describe('friendlyError', () => {
  it('turns what Supabase and the browser say into something friendlier', () => {
    expect(friendlyError(new Error('Invalid login credentials'), 'x')).toMatch(/don't match!/);
    expect(friendlyError(new TypeError('Failed to fetch'), 'x')).toMatch(/connection/);
  });
  it('names what went wrong when signing up, rather than "try again"', () => {
    expect(friendlyError(new Error('Error sending confirmation email'), 'x')).toMatch(/email didn’t send/);
    expect(friendlyError(new Error('Password is known to be weak and easy to guess, please choose a different one.'), 'x')).toMatch(/leak/);
    expect(friendlyError(new Error('Email address "a@b" is invalid'), 'x')).toMatch(/typos/);
    expect(friendlyError(new Error('Signups not allowed for this instance'), 'x')).toMatch(/Sign-ups are off/);
    expect(friendlyError(new Error('Database error saving new user'), 'x')).toMatch(/ledger/);
    expect(friendlyError(new Error('email rate limit exceeded'), 'x')).toMatch(/too many tries/);
  });
  it('falls back to the caller’s own message', () => {
    expect(friendlyError(new Error('something odd'), 'That fizzled!')).toBe('That fizzled!');
    expect(friendlyError(undefined, 'That fizzled!')).toBe('That fizzled!');
  });
});
