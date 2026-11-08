import { describe, expect, it } from 'vitest';
import index from '$lib/data/entry-index.json';
import { entryUrl, registerEntryIndex, trackerUrl } from '$lib/rules/lookup';

registerEntryIndex(index as never);

describe('trackers named for something on 5e.tools', () => {
  it('opens a spell a species gives, not the species', () => {
    expect(trackerUrl({ label: 'Invisibility', class: 'Tiefling (Glasya)' }, [], ['mtf'])).toBe('https://5e.tools/spells.html#invisibility_phb');
    expect(trackerUrl({ label: 'Disguise Self (1/day)', class: 'Tiefling' }, [], ['mtf'])).toBe('https://5e.tools/spells.html#disguise%20self_phb');
  });
  it('opens the 2024 spell for a 2024 sheet', () => {
    expect(entryUrl('Invisibility', undefined, ['xphb'])).toBe('https://5e.tools/spells.html#invisibility_xphb');
  });
  it('opens feats, items, invocations and species', () => {
    expect(trackerUrl({ label: 'Luck Points', class: 'Lucky' })).toContain('feats.html#lucky_');
    expect(trackerUrl({ label: 'Wand of Magic Missiles' })).toContain('items.html#wand%20of%20magic%20missiles_');
    expect(trackerUrl({ label: 'Agonizing Blast', class: 'Warlock' })).toContain('optionalfeatures.html#agonizing%20blast_');
    expect(trackerUrl({ label: 'Breath Weapon', class: 'Dragonborn' })).toContain('races.html#dragonborn_');
  });
  it('still opens a class feature on the class page', () => {
    expect(trackerUrl({ label: 'Second Wind', class: 'Fighter' })).toContain('classes.html#fighter_xphb,state:feature=s0-1');
  });
});
