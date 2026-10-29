/** Light or dark, remembered per device. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { readFileSync } from 'node:fs';
import { MODE_KEY, applyMode, mode, storedMode, toggleMode } from '$lib/stores/mode';

describe('mode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-mode');
    applyMode('dark');
    localStorage.clear();
  });

  afterEach(() => vi.restoreAllMocks());

  it('is dark when nothing was ever chosen', () => {
    expect(storedMode()).toBe('dark');
  });

  it('is light only when light was chosen', () => {
    localStorage.setItem(MODE_KEY, 'light');
    expect(storedMode()).toBe('light');
    localStorage.setItem(MODE_KEY, 'dark');
    expect(storedMode()).toBe('dark');
    localStorage.setItem(MODE_KEY, 'nonsense');
    expect(storedMode()).toBe('dark');
  });

  it('falls back to dark when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private window');
    });
    expect(storedMode()).toBe('dark');
  });

  it('marks the document for light and unmarks it for dark', () => {
    applyMode('light');
    expect(document.documentElement.getAttribute('data-mode')).toBe('light');
    applyMode('dark');
    // Dark is the default, so it is the absence of a mark rather than a mark.
    expect(document.documentElement.hasAttribute('data-mode')).toBe(false);
  });

  it('still applies the mode when storage refuses to keep it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('private window');
    });
    expect(() => applyMode('light')).not.toThrow();
    expect(document.documentElement.getAttribute('data-mode')).toBe('light');
  });

  it('flips, and remembers which way it flipped', () => {
    mode.set('dark');
    toggleMode();
    expect(get(mode)).toBe('light');
    expect(localStorage.getItem(MODE_KEY)).toBe('light');
    toggleMode();
    expect(get(mode)).toBe('dark');
    expect(localStorage.getItem(MODE_KEY)).toBe('dark');
  });

  it('is decided by the shell before the first paint', () => {
    // Otherwise a light-mode reader gets a dark frame on every cold load,
    // the same way the app used to flash past the splash.
    const shell = readFileSync('src/app.html', 'utf8');
    expect(shell).toContain(MODE_KEY);
    expect(shell.indexOf(MODE_KEY)).toBeLessThan(shell.indexOf('<body'));
    expect(shell).toMatch(/setAttribute\('data-mode', 'light'\)/);
  });
});
