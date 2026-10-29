/**
 * The save status. Its one hard requirement is that it never changes the
 * size of the row it sits in: on a phone the old word pushed the controls
 * onto a second line and shoved the whole sheet down every time you typed.
 */
import { render } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Writable } from 'svelte/store';

// The real store only exposes the moves the app makes; these need to sit it
// in each state directly, so they render against a stand-in.
vi.mock('$lib/stores/sheet', async () => {
  const { writable } = await import('svelte/store');
  return { sheetStore: writable({ sheet: null, status: 'idle', message: null }) };
});

import SaveIndicator from '$lib/components/SaveIndicator.svelte';
import SaveAlert from '$lib/components/SaveAlert.svelte';
import { sheetStore } from '$lib/stores/sheet';

const fake = sheetStore as unknown as Writable<{
  sheet: null;
  status: string;
  message: string | null;
}>;

const indicator = readFileSync('src/lib/components/SaveIndicator.svelte', 'utf8');
const sheet = readFileSync('src/routes/s/[id]/+page.svelte', 'utf8');

const STATES = ['idle', 'saving', 'saved', 'unsaved', 'stale', 'error'] as const;

const setStatus = (status: string, message: string | null = null) =>
  fake.set({ sheet: null, status, message });

describe('save indicator', () => {
  it('says what happened, in words', () => {
    // A coloured dot asked the reader to know what the colour meant, and the
    // accent is the character's own — a red character reporting a red
    // "saved" is worse than no indicator.
    for (const [status, word] of [
      ['saving', 'Saving…'],
      ['saved', 'Saved'],
      ['unsaved', 'Not saved'],
      ['stale', 'Changed elsewhere']
    ]) {
      setStatus(status);
      const { container, unmount } = render(SaveIndicator);
      expect(container.querySelector('.saveword')?.textContent?.trim(), status).toBe(word);
      unmount();
    }
  });

  it('says nothing at all when there is nothing to say', () => {
    setStatus('idle');
    const { container } = render(SaveIndicator);
    expect(container.querySelector('.saveword')).toBeNull();
  });

  it('floats in the corner, so a word costs the header nothing', () => {
    const css = indicator.slice(indicator.indexOf('.saveword {'), indicator.indexOf('@media'));
    expect(css).toMatch(/position: fixed/);
    expect(css).toMatch(/right: 1rem/);
    expect(css).toMatch(/bottom:/);
    // Neutral on purpose: the sentence carries the meaning, not the hue.
    expect(css).toMatch(/color: var\(--dim\)/);
    expect(css).not.toMatch(/var\(--a[-)]|var\(--danger\)/);
    // And it cannot swallow a tap meant for what is underneath.
    expect(css).toMatch(/pointer-events: none/);
  });

  it('is announced, not just shown', () => {
    setStatus('saving');
    const { container } = render(SaveIndicator);
    const el = container.querySelector('.saveword')!;
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });
});

describe('save alert', () => {
  it('stays out of the way while a save is merely pending', () => {
    // `unsaved` is the ordinary queued state as well as the failed one.
    setStatus('unsaved', null);
    const { container } = render(SaveAlert);
    expect(container.querySelector('.stale-banner')).toBeNull();
  });

  it('speaks up when the write did not land', () => {
    for (const [status, message] of [['stale', 'Changed elsewhere'], ['unsaved', 'Could not save']]) {
      setStatus(status, message);
      const { container, unmount } = render(SaveAlert);
      const alert = container.querySelector('.stale-banner');
      expect(alert, status).toBeTruthy();
      expect(alert!.textContent, status).toContain(message!);
      // Only a conflict can be resolved by reloading.
      expect(Boolean(alert!.querySelector('button')), status).toBe(status === 'stale');
      unmount();
    }
    setStatus('idle');
  });
});

describe('the controls row', () => {
  it('keeps undo in place whether or not there is anything to undo', () => {
    const row = sheet.slice(sheet.indexOf('<div class="controls">'), sheet.indexOf('</header>'));
    // Always rendered, so the row is laid out once; inert until it is useful.
    expect(row).toMatch(/<button\s+class="undo"\s+disabled=\{!\$canUndo\}/);
    expect(row).not.toMatch(/\{#if \$canUndo\}/);
    // First, where it has always been.
    expect(row.indexOf('class="undo"')).toBeLessThan(row.indexOf('class="edit"'));
    expect(row.indexOf('class="edit"')).toBeLessThan(row.indexOf('ModeToggle'));
    // One word, in both states: the muting is the context.
    expect(row).toMatch(/>Undo<\/button/);
  });

  it('mutes the undo button rather than hiding it', () => {
    const css = sheet.slice(sheet.indexOf('  .undo {'), sheet.indexOf('  .back {'));
    expect(css).toMatch(/\.undo:disabled \{[^}]*color: var\(--faint\)/);
    expect(css).toMatch(/\.undo:disabled \{[^}]*cursor: default/);
    // Lit, it has a surface of its own: it sits over the banner.
    expect(css).toMatch(/background: var\(--a-wash\)/);
  });

  it('keeps the status out of the header entirely', () => {
    const header = sheet.slice(sheet.indexOf('<header class="identity"'), sheet.indexOf('</header>'));
    expect(header).not.toContain('SaveIndicator');
    expect(sheet).toMatch(/<SaveAlert \/>[\s\S]*<SaveIndicator \/>/);
  });
});
