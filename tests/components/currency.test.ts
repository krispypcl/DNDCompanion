import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/svelte';
import Currency from '$lib/components/Currency.svelte';

describe('Currency', () => {
  it('runs copper to platinum, left to right, with no electrum', () => {
    const { container } = render(Currency, {
      props: { definition: { currency: { cp: 1, sp: 2, ep: 9, gp: 3, pp: 4 } } as never, editable: false, onchange: () => {} }
    });
    expect([...container.querySelectorAll('.cap')].map((e) => e.textContent)).toEqual(['cp', 'sp', 'gp', 'pp']);
    expect([...container.querySelectorAll('strong')].map((e) => e.textContent)).toEqual(['1', '2', '3', '4']);
  });
});
