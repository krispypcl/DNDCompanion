import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';
import D20Loader from '$lib/components/D20Loader.svelte';

describe('D20Loader', () => {
  it('tumbles while loading and lands on a natural 20', async () => {
    vi.useFakeTimers();
    const onlanded = vi.fn();
    const { rerender, container } = render(D20Loader, { props: { result: null, label: 'Loading the sheet', onlanded } });
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Loading the sheet');
    const face = () => container.querySelector('text')!.textContent;
    vi.advanceTimersByTime(1000);
    expect(['1', '20']).not.toContain(face());

    await rerender({ result: 20, label: 'Loading the sheet', onlanded });
    expect(face()).toBe('20');
    expect(onlanded).not.toHaveBeenCalled();
    vi.advanceTimersByTime(700);
    expect(onlanded).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('lands on a natural 1 when loading failed', async () => {
    const { container } = render(D20Loader, { props: { result: 1 } });
    expect(container.querySelector('text')!.textContent).toBe('1');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Could not load');
  });
});
