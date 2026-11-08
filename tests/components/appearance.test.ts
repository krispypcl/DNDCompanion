/** The Appearance tab: pictures to look at when reading, not links. */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LinksPanel from '$lib/components/LinksPanel.svelte';

const definition = (identity: Record<string, unknown> = {}) => ({
  identity: { name: 'Loka', level: 5, ...identity },
  abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiency: 3,
  combat: {}, saves: {}, skills: {}, attacks: [], features: [], spells: [], trackers: [], equipment: [],
  currency: {}, notes: ''
}) as never;

describe('Appearance', () => {
  it('shows empty frames when there are no pictures', () => {
    const { container } = render(LinksPanel, { props: { definition: definition(), editable: false, onchange: () => {} } });
    expect(container.querySelectorAll('.pic.empty').length).toBe(2);
  });
  it('shows the portrait as a picture, not a link', () => {
    const { container } = render(LinksPanel, {
      props: { definition: definition({ portraitUrl: 'https://example.test/loka.png' }), editable: false, onchange: () => {} }
    });
    expect(screen.getByAltText('Portrait of Loka')).toBeTruthy();
    expect(container.querySelector('a[href="https://example.test/loka.png"]')).toBeNull();
  });
  it('keeps the theme with the pictures while editing', () => {
    render(LinksPanel, { props: { definition: definition(), editable: true, onchange: () => {} } });
    expect(screen.getByText('Character theme')).toBeTruthy();
  });
});
