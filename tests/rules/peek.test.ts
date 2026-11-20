import { describe, expect, it } from 'vitest';
import { peekTarget } from '#lib/rules/peek.ts';
import { inline, render } from '#lib/rules/fiveRender.ts';

describe('peekTarget', () => {
  it('reads an entry page link', () => {
    expect(peekTarget('https://5e.tools/spells.html#fireball_xphb')).toEqual({ page: 'spells', name: 'fireball', source: 'xphb' });
    expect(peekTarget('https://5e.tools/items.html#leather%20armor_xphb')).toEqual({ page: 'items', name: 'leather armor', source: 'xphb' });
  });
  it('reads a class feature and a subclass', () => {
    expect(peekTarget('https://5e.tools/classes.html#fighter_xphb,state:feature=s0-1')).toEqual({
      page: 'classes', name: 'fighter', source: 'xphb', feature: { level: 1, index: 1 }
    });
    expect(peekTarget('https://5e.tools/classes.html#fighter_xphb,state:feature=s2-0~sub_battle%20master_xphb=b1')).toMatchObject({
      subclass: { name: 'battle master', source: 'xphb' }, feature: { level: 3, index: 0 }
    });
  });
  it('reads a search', () => {
    expect(peekTarget('https://5e.tools/search.html?q=Leather%20Armor%20in%3Aitm%20source%3Axphb&lucky')).toEqual({
      page: 'items', name: 'Leather Armor', source: 'xphb'
    });
    expect(peekTarget('https://5e.tools/search.html?q=Second%20Wind&lucky')).toEqual({ page: 'any', name: 'Second Wind', source: '' });
    expect(peekTarget('https://www.dndbeyond.com/spells/fireball')).toBeNull();
  });
});

describe('5e.tools text', () => {
  it('turns tags into words, safely', () => {
    expect(inline('Deal {@damage 8d6} {@b fire} damage to {@creature goblin|mm|goblins}.')).toBe('Deal 8d6 <b>fire</b> damage to goblins.');
    expect(inline('{@atkr m} {@hit 5} {@h}{@dc 15} <script>')).toBe('<i>Melee Attack Roll:</i> +5 <i>Hit:</i> DC 15 &lt;script&gt;');
    expect(inline('{@note see {@spell shield}}')).toBe('<span class="five-note">see shield</span>');
  });

  it('shows a class feature tag by its words, not its book', () => {
    expect(inline('expend one {@classFeature Risk|Gunslinger|ValdaGunslinger|2|ValdaGunslinger|Risk Die}')).toBe('expend one Risk Die');
    expect(inline('{@classFeature Rage|Barbarian|XPHB|1|XPHB}')).toBe('Rage');
    expect(inline('{@subclassFeature Path of the Berserker|Barbarian|XPHB|Berserker|XPHB|3|XPHB}')).toBe('Path of the Berserker');
    expect(inline('{@subclassFeature Frenzy|Barbarian|XPHB|Berserker|XPHB|3|XPHB|a frenzy}')).toBe('a frenzy');
  });

  it('shows a spell from its name to its book', () => {
    const r = render({
      kind: 'spell',
      entry: {
        name: 'Fireball', source: 'XPHB', page: 274, level: 3, school: 'V',
        time: [{ number: 1, unit: 'action' }], range: { type: 'point', distance: { type: 'feet', amount: 150 } },
        components: { v: true, s: true, m: 'a ball of bat guano and sulfur' }, duration: [{ type: 'instant' }],
        entries: ['A bright streak flashes.'], entriesHigherLevel: [{ type: 'entries', name: 'Using a Higher-Level Spell Slot', entries: ['More {@scaledamage 8d6|3-9|1d6}.'] }]
      }
    });
    expect(r.kind).toBe('Level 3 Evocation');
    expect(r.facts).toEqual([
      ['Casting Time', 'Action'], ['Range', '150 feet'], ['Components', 'V, S, M (a ball of bat guano and sulfur)'], ['Duration', 'Instantaneous']
    ]);
    expect(r.html).toContain('<h4>Using a Higher-Level Spell Slot</h4><p>More 1d6.</p>');
    expect(r.source).toBe('Player&#39;s Handbook (2024), page 274');
  });

  it('shows an item with no text of its own', () => {
    const armor = render({ kind: 'item', entry: { name: 'Leather Armor', source: 'XPHB', page: 219, type: 'LA|XPHB', rarity: 'none', weight: 10, value: 1000, ac: 11 } });
    expect(armor.kind).toBe('Light Armor');
    expect(armor.facts).toEqual([['Armor Class', '11 + Dex modifier'], ['Weight', '10 lb.'], ['Cost', '10 GP']]);
    const sword = render({ kind: 'item', entry: { name: 'Longsword', source: 'XPHB', type: 'M|XPHB', weaponCategory: 'martial', property: ['V|XPHB'], mastery: ['Sap|XPHB'], dmg1: '1d8', dmgType: 'S', dmg2: '1d10', weight: 3, value: 1500 } });
    expect(sword.kind).toBe('Martial Melee Weapon');
    expect(sword.facts).toContainEqual(['Damage', '1d8 Slashing']);
    expect(render({ kind: 'feat', entry: { name: 'A & B', category: 'O', entries: [] } }).name).toBe('A &amp; B');
    expect(sword.facts).toContainEqual(['Properties', 'Versatile (1d10)']);
    expect(sword.facts).toContainEqual(['Mastery', 'Sap']);
  });
});
