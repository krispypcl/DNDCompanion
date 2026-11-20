import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import PhoneBar from '#lib/components/PhoneBar.svelte';

const places = [
  { key: 'party', label: 'Party', icon: 'party' as const },
  { key: 'fight', label: 'Fight', icon: 'fight' as const, badge: true },
  { key: 'board', label: 'Board', icon: 'board' as const }
];

describe('PhoneBar', () => {
  it('shows every place, the current one marked, and a dot where it is wanted', () => {
    const { container } = render(PhoneBar, { props: { places, active: 'party', onchoose: () => {} } });
    const buttons = [...container.querySelectorAll('.place')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Party', 'Fight', 'Board']);
    expect(buttons[0].getAttribute('aria-current')).toBe('page');
    expect(buttons[1].getAttribute('aria-current')).toBeNull();
    expect(buttons[1].querySelector('.ic.badge')).not.toBeNull();
  });

  it('says which place was chosen', async () => {
    const onchoose = vi.fn();
    const { container } = render(PhoneBar, { props: { places, active: 'party', onchoose } });
    await fireEvent.click(container.querySelectorAll('.place')[2]);
    expect(onchoose).toHaveBeenCalledWith('board');
  });

  it('keeps room free at the page foot and tells the rest of the page how tall it is', () => {
    const { container, unmount } = render(PhoneBar, { props: { places, active: 'party', onchoose: () => {} } });
    expect(container.querySelector('.barroom')).not.toBeNull();
    expect(document.documentElement.style.getPropertyValue('--foot')).toMatch(/px$/);
    unmount();
    expect(document.documentElement.style.getPropertyValue('--foot')).toBe('');
  });
});
