import { describe, expect, it } from 'vitest';
import { tick } from 'svelte';
import { render } from '@testing-library/svelte';
import HurtEdges from '#lib/components/HurtEdges.svelte';

/** The edges ease in a frame after they mount. */
const nextFrame = async () => {
  await new Promise((done) => requestAnimationFrame(done));
  await tick();
};

const hurt = async (current: number, max: number) => {
  const { container } = render(HurtEdges, { props: { current, max } });
  await nextFrame();
  return Number(container.querySelector<HTMLElement>('.edges')!.dataset.hurt);
};

describe('HurtEdges', () => {
  it('is out of the way: not announced, not clickable', () => {
    const { container } = render(HurtEdges, { props: { current: 3, max: 44 } });
    const edges = container.querySelector('.edges')!;
    expect(edges.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.edge')).toHaveLength(2);
  });

  it('eases in from nothing when it arrives', async () => {
    const { container } = render(HurtEdges, { props: { current: 3, max: 44 } });
    const edges = container.querySelector<HTMLElement>('.edges')!;
    expect(Number(edges.dataset.hurt)).toBe(0);
    await nextFrame();
    expect(Number(edges.dataset.hurt)).toBeGreaterThan(0);
  });

  it('has nothing to show at or above half health', async () => {
    expect(await hurt(44, 44)).toBe(0);
    expect(await hurt(22, 44)).toBe(0);
  });

  it('shows below half, and more the lower it gets', async () => {
    const levels = await Promise.all([20, 12, 4, 0].map((hp) => hurt(hp, 44)));
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels.at(-1)).toBe(1);
  });

  it('breathes only when critical', async () => {
    const calm = render(HurtEdges, { props: { current: 20, max: 44 } }).container;
    const grim = render(HurtEdges, { props: { current: 3, max: 44 } }).container;
    await nextFrame();
    expect(calm.querySelector('.critical')).toBeNull();
    expect(grim.querySelector('.critical')).not.toBeNull();
  });
});
