import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyMotion, reduceMotionNow, setReduceMotion } from '#lib/prefs.ts';
import { prefersReducedMotion } from '#lib/motion.ts';

/** Sets what the device says about reduced motion. */
let deviceReduces = false;
const realMatchMedia = window.matchMedia;

beforeEach(() => {
  deviceReduces = false;
  localStorage.clear();
  document.documentElement.removeAttribute('data-motion');
  window.matchMedia = ((query: string) => ({
    ...realMatchMedia(query),
    matches: query.includes('prefers-reduced-motion') && deviceReduces
  })) as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

const marker = () => document.documentElement.dataset.motion;

describe('reduced motion', () => {
  it('follows the device until the player chooses', () => {
    applyMotion();
    expect(marker()).toBe('full');
    deviceReduces = true;
    applyMotion();
    expect(marker()).toBe('reduce');
    expect(reduceMotionNow()).toBe(true);
    expect(prefersReducedMotion()).toBe(true);
  });

  it('keeps a choice that differs from the device, either way', () => {
    expect(setReduceMotion(true)).toBe(true);
    expect(marker()).toBe('reduce');
    deviceReduces = true;
    expect(setReduceMotion(false)).toBe(false);
    expect(marker()).toBe('full');
    // The device asks for less, but the player chose full motion.
    applyMotion();
    expect(marker()).toBe('full');
    expect(prefersReducedMotion()).toBe(false);
  });

  it('goes back to following the device when the choice matches it', () => {
    setReduceMotion(true);
    expect(setReduceMotion(false)).toBeNull();
    deviceReduces = true;
    applyMotion();
    expect(marker()).toBe('reduce');
  });
});
