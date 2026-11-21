import { describe, expect, it } from 'vitest';
import { canPrompt, installed, platform } from '../src/lib/install.ts';

describe('install', () => {
  it('tells an iPhone, an Android phone and anything else apart', () => {
    expect(platform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')).toBe('ios');
    expect(platform('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36')).toBe('android');
    expect(platform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36')).toBe('other');
  });

  it('has nothing to offer until the browser offers it', () => {
    expect(canPrompt()).toBe(false);
    expect(installed()).toBe(false);
  });
});
