import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import PhoneBar from '#lib/components/PhoneBar.svelte';
import BottomBar from '#lib/components/BottomBar.svelte';
import { chrome, type BarSpec } from '#lib/stores/chrome.svelte.ts';

const places = [
  { key: 'party', label: 'Party', icon: 'party' as const },
  { key: 'fight', label: 'Fight', icon: 'fight' as const, badge: true },
  { key: 'board', label: 'Board', icon: 'board' as const }
];
const spec = (onchoose = () => {}): BarSpec => ({ places, active: 'party', onchoose, owner: Symbol('test') });

describe('BottomBar (drawn by the layout)', () => {
  it('shows every place, the current one marked, and a dot where it is wanted', () => {
    const { container } = render(BottomBar, { props: { spec: spec() } });
    const buttons = [...container.querySelectorAll('.place')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Party', 'Fight', 'Board']);
    expect(buttons[0].getAttribute('aria-current')).toBe('page');
    expect(buttons[1].getAttribute('aria-current')).toBeNull();
    expect(buttons[1].querySelector('.ic.badge')).not.toBeNull();
  });

  it('says which place was chosen', async () => {
    const onchoose = vi.fn();
    const { container } = render(BottomBar, { props: { spec: spec(onchoose) } });
    await fireEvent.click(container.querySelectorAll('.place')[2]);
    expect(onchoose).toHaveBeenCalledWith('board');
  });

  it('tells the rest of the page how tall it is, and forgets it when it goes', () => {
    const { unmount } = render(BottomBar, { props: { spec: spec() } });
    expect(document.documentElement.style.getPropertyValue('--foot')).toMatch(/px$/);
    unmount();
    expect(document.documentElement.style.getPropertyValue('--foot')).toBe('');
  });
});

describe('PhoneBar (what a page puts in it)', () => {
  it('hands the page’s places to the bar and takes them back when the page goes', () => {
    const { unmount } = render(PhoneBar, { props: { places, active: 'fight', onchoose: () => {} } });
    flushSync();
    expect(chrome.bar?.places.map((p) => p.key)).toEqual(['party', 'fight', 'board']);
    expect(chrome.bar?.active).toBe('fight');
    unmount();
    expect(chrome.bar).toBeNull();
  });
});
