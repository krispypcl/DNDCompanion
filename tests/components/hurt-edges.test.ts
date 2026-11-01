import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import HurtEdges from '$lib/components/HurtEdges.svelte';

const hurt = (current: number, max: number) => {
  const { container } = render(HurtEdges, { props: { current, max } });
  return Number(container.querySelector<HTMLElement>('.edges')!.dataset.hurt);
};

describe('HurtEdges', () => {
  it('is out of the way: not announced, not clickable', () => {
    const { container } = render(HurtEdges, { props: { current: 3, max: 44 } });
    const edges = container.querySelector('.edges')!;
    expect(edges.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelectorAll('.edge')).toHaveLength(2);
  });

  it('has nothing to show at or above half health', () => {
    expect(hurt(44, 44)).toBe(0);
    expect(hurt(22, 44)).toBe(0);
  });

  it('shows below half, and more the lower it gets', () => {
    const levels = [20, 12, 4, 0].map((hp) => hurt(hp, 44));
    expect(levels[0]).toBeGreaterThan(0);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels.at(-1)).toBe(1);
  });

  it('breathes only when critical', () => {
    const calm = render(HurtEdges, { props: { current: 20, max: 44 } }).container;
    expect(calm.querySelector('.critical')).toBeNull();
    const grim = render(HurtEdges, { props: { current: 3, max: 44 } }).container;
    expect(grim.querySelector('.critical')).not.toBeNull();
  });
});
