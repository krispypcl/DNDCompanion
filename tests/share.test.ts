import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { sheetLink } from '$lib/rules/share';
import { copyText } from '$lib/clipboard';
import ShareButton from '$lib/components/ShareButton.svelte';

describe('sheetLink', () => {
  it('joins origin, base path and id', () => {
    expect(sheetLink('https://krispypcl.github.io', '/DNDCompanion', 'abc')).toBe(
      'https://krispypcl.github.io/DNDCompanion/s/abc'
    );
  });

  it('works with no base path, and tolerates stray slashes', () => {
    expect(sheetLink('https://x.test/', '', 'abc')).toBe('https://x.test/s/abc');
    expect(sheetLink('https://x.test', '/app/', 'abc')).toBe('https://x.test/app/s/abc');
  });
});

describe('copyText', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the clipboard when there is one', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    expect(await copyText('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to selecting and copying when the clipboard refuses', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => { throw new Error('denied'); }) },
      configurable: true
    });
    const exec = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    expect(await copyText('hello')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    // Leaves nothing behind.
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('says so when neither way works', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    (document as unknown as { execCommand: unknown }).execCommand = () => false;
    expect(await copyText('hello')).toBe(false);
  });
});

describe('ShareButton', () => {
  it('copies the sheet link and reports it', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const oncopied = vi.fn();
    render(ShareButton, { props: { id: 'sheet-1', oncopied } });
    await fireEvent.click(screen.getByLabelText('Copy link to this sheet'));
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/s/sheet-1`);
    expect(oncopied).toHaveBeenCalledWith(true);
  });
});
