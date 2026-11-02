import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import DownScreen from '$lib/components/DownScreen.svelte';
import { emptyState } from '$lib/types';

describe('DownScreen', () => {
  it('beats twice on going down, then keeps a vignette', async () => {
    const { container, rerender } = render(DownScreen, { props: { state: { ...emptyState(), hpCurrent: 5 }, hpMax: 20 } });
    expect(container.querySelector('.vignette')).toBeNull();
    await rerender({ state: { ...emptyState(), hpCurrent: 0 }, hpMax: 20 });
    expect(container.querySelector('.heartbeat')).not.toBeNull();
    expect(container.querySelector('.vignette:not(.dead)')).not.toBeNull();
  });

  it('flashes on each death save, red for a failure, and stops beating when dead', async () => {
    const down = { ...emptyState(), hpCurrent: 0 };
    const { container, rerender } = render(DownScreen, { props: { state: down, hpMax: 20 } });
    expect(container.querySelector('.heartbeat')).toBeNull();
    await rerender({ state: { ...down, deathSaves: { successes: 1, failures: 0 } }, hpMax: 20 });
    expect(container.querySelector('.flash.save')).not.toBeNull();
    await rerender({ state: { ...down, deathSaves: { successes: 1, failures: 3 } }, hpMax: 20 });
    expect(container.querySelector('.flash.fail')).not.toBeNull();
    expect(container.querySelector('.vignette.dead')).not.toBeNull();
  });
});
