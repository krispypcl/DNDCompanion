import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import ConditionOverlay from '$lib/components/ConditionOverlay.svelte';

describe('ConditionOverlay', () => {
  it('tints for the standard conditions only, once each', () => {
    const { container } = render(ConditionOverlay, { props: { conditions: ['Charmed', 'Bless', 'Exhaustion 2', 'charmed'] } });
    const tints = [...container.querySelectorAll('[data-condition]')].map((el) => el.getAttribute('data-condition'));
    expect(tints).toEqual(['charmed', 'exhaustion']);
    expect(container.querySelectorAll('.tint.on')).toHaveLength(1);
  });

  it('tints for a condition of the player\'s own, in their colour', () => {
    const { container } = render(ConditionOverlay, {
      props: { conditions: ['Bless'], looks: { bless: { color: '#ffcc00', motion: 'shimmer' } } }
    });
    const tint = container.querySelector('[data-condition="bless"]') as HTMLElement;
    expect(tint.classList.contains('shimmer')).toBe(true);
    expect(tint.style.getPropertyValue('--tint')).toBe('#ffcc00');
  });

  it('has a look for Dead', () => {
    const { container } = render(ConditionOverlay, { props: { conditions: ['Dead'] } });
    expect(container.querySelector('[data-condition="dead"]')).not.toBeNull();
  });
});
