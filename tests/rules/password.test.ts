import { describe, expect, it } from 'vitest';
import { passwordStrength } from '$lib/rules/password';

describe('password strength', () => {
  it('says nothing about an empty field', () => {
    expect(passwordStrength('')).toMatchObject({ score: 0, hint: null });
  });

  it('is too weak under the minimum length', () => {
    expect(passwordStrength('Ab1!')).toMatchObject({ score: 0, label: 'Too weak' });
  });

  it('knows the passwords everyone tries first', () => {
    expect(passwordStrength('password123').score).toBe(0);
    expect(passwordStrength('P@ssw0rd').score).toBe(0);
    expect(passwordStrength('Dungeons').score).toBe(0);
  });

  it('does not count a run of one key, or a keyboard row, as length', () => {
    expect(passwordStrength('aaaaaaaaaaaaaaaa').score).toBeLessThanOrEqual(1);
    expect(passwordStrength('abcdefghijklmnop').score).toBeLessThanOrEqual(1);
  });

  it('marks down a password with the email name in it', () => {
    expect(passwordStrength('loka-sibbs-2024!', 'loka@example.com')).toMatchObject({ score: 1 });
  });

  it('rises with length and variety', () => {
    const scores = ['tavernbard', 'Tavernbard7', 'Tavern-bard-7-rolls', 'quiet Tavern bard 7 rolls!'].map(
      (p) => passwordStrength(p).score
    );
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
    expect(scores.at(-1)).toBe(4);
  });
});
