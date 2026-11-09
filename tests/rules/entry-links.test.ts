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

describe('walking speed from the species', () => {
  it('knows a Wood Elf walks 35 ft. and a 2014 dwarf 25', async () => {
    const { speciesWalk } = await import('$lib/rules/lookup');
    expect(speciesWalk('Wood Elf')).toBe(35);
    expect(speciesWalk('Elf (Wood)')).toBe(35);
    expect(speciesWalk('Dwarf', 'phb')).toBe(25);
    expect(speciesWalk('Dwarf')).toBe(30);
    expect(speciesWalk('Tiefling (Glasya)')).toBe(30);
    expect(speciesWalk('Moonfolk')).toBeNull();
  });
});
