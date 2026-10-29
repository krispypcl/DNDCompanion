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
  it('is in the document in every state, including when idle', () => {
    for (const status of STATES) {
      setStatus(status);
      const { container, unmount } = render(SaveIndicator);
      const dot = container.querySelector('.dot');
      expect(dot, status).toBeTruthy();
      expect(dot!.className, status).toContain(status);
      unmount();
    }
  });

  it('says nothing that takes up room', () => {
    // A fixed box, and the words only where they cost no layout.
    const css = indicator.slice(indicator.indexOf('.dot {'), indicator.indexOf('.saving {'));
    expect(css).toMatch(/width: 0\.5rem/);
    expect(css).toMatch(/height: 0\.5rem/);
    expect(css).not.toMatch(/min-width|padding/);
    expect(indicator).toMatch(/class="sr"/);
    expect(indicator).toMatch(/title=\{label\}/);
  });

  it('names the state for anyone who cannot see a colour', () => {
    setStatus('saving');
    const { container } = render(SaveIndicator);
    expect(container.querySelector('.sr')?.textContent).toBe('Saving…');
    expect(container.querySelector('.dot')?.getAttribute('title')).toBe('Saving…');
    expect(container.querySelector('.dot')?.getAttribute('role')).toBe('status');
  });

  it('shows the message itself when a save has failed', () => {
    setStatus('unsaved', 'Could not save');
    const { container } = render(SaveIndicator);
    expect(container.querySelector('.dot')?.className).toContain('failed');
    expect(container.querySelector('.sr')?.textContent).toBe('Could not save');
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
  it('keeps the undo button last, where it cannot move the others', () => {
    const row = sheet.slice(sheet.indexOf('<div class="controls">'), sheet.indexOf('</header>'));
    expect(row.indexOf('SaveIndicator')).toBeLessThan(row.indexOf('class="edit"'));
    expect(row.indexOf('ModeToggle')).toBeLessThan(row.indexOf('class="undo"'));
    // And is short enough on a phone not to wrap the row onto two lines.
    expect(sheet).toMatch(/\.undo \.what \{ display: none; \}/);
  });

  it('gives the undo button a surface, since it sits over the banner', () => {
    const css = sheet.slice(sheet.indexOf('  .undo {'), sheet.indexOf('  .back {'));
    expect(css).toMatch(/background: var\(--a-wash\)/);
    expect(css).not.toMatch(/background: none/);
  });
});
