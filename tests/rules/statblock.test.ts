import { describe, expect, it } from 'vitest';
import fx from './fixtures-monsters.json';
import { cleanStatBlock, fromFiveTools, initiativeBonus, kindLine, leadingNumber, statBlockHtml } from '$lib/rules/statblock';
import { peekTarget } from '$lib/rules/peek';

describe('stat blocks from 5e.tools', () => {
  const sb = fromFiveTools(fx.goblinBoss);
  it('reads the top of a monster', () => {
    expect(kindLine(sb)).toBe('Small Fey (Goblinoid), Chaotic Neutral');
    expect(sb.ac).toBe('17');
    expect(sb.hp).toBe('21 (6d6)');
    expect(sb.speed).toBe('30 ft.');
    expect([sb.str, sb.dex, sb.wis]).toEqual([10, 15, 8]);
    expect(sb.skills).toBe('Stealth +6');
    expect(sb.senses).toBe('Darkvision 60 ft., Passive Perception 9');
    expect(sb.languages).toBe('Common, Goblin');
    expect(sb.cr).toBe('1');
    expect(initiativeBonus(sb)).toBe(2);
  });
  it('turns its actions into plain words', () => {
    expect(sb.actions?.map((a) => a.name)).toEqual(['Multiattack', 'Scimitar', 'Shortbow']);
    const scimitar = sb.actions?.[1].text ?? '';
    expect(scimitar).not.toMatch(/[{}<>]/);
    expect(scimitar).toMatch(/\+4/);
    expect(sb.bonus?.[0].name).toBe('Nimble Escape');
    expect(sb.reactions?.[0].name).toBe('Redirect Attack');
  });
  it('lists spellcasting with its spells, where 5e.tools shows it', () => {
    const caster = fromFiveTools({ name: 'Caster', source: 'XMM', spellcasting: fx.aeromancerCasting });
    expect(caster.actions?.[0].name).toBe('Spellcasting');
    expect(caster.actions?.[0].text).toMatch(/At will: Elementalism, Gust of Wind/);
    expect(caster.actions?.[0].text).toMatch(/1\/day: Lightning Bolt/);
    expect(caster.reactions?.[0].name).toBe('Feather Fall (1/Day)');
  });
});

describe('stat blocks the DM writes', () => {
  it('keeps only what fits', () => {
    const sb = cleanStatBlock({ ac: ' 12 ', str: '40', dex: 'x', junk: 1, actions: [{ name: 'Bite', text: 'Ouch' }, { name: '', text: '' }] });
    expect(sb).toEqual({ ac: '12', str: 30, actions: [{ name: 'Bite', text: 'Ouch' }] });
    expect(leadingNumber('17 (natural armor)')).toBe(17);
    expect(leadingNumber('')).toBeNull();
  });
  it('is escaped when drawn', () => {
    const html = statBlockHtml({ ac: '<b>12</b>', traits: [{ name: 'Sneaky <i>', text: 'line one\nline two' }] });
    expect(html).toContain('&lt;b&gt;12&lt;/b&gt;');
    expect(html).toContain('line one<br>line two');
    expect(html).not.toContain('<i>');
  });
});

describe('bestiary links', () => {
  it('reads a monster page and a creature search', () => {
    expect(peekTarget('https://5e.tools/bestiary.html#goblin%20boss_xmm')).toEqual({ page: 'bestiary', name: 'goblin boss', source: 'xmm' });
    expect(peekTarget('https://5e.tools/search.html?q=Goblin in:bestiary')).toMatchObject({ page: 'bestiary', name: 'Goblin' });
  });
});

describe('monsterArt', async () => {
  const { monsterArt, FIVE_IMG } = await import('$lib/rules/statblock');
  it('names the token as 5e.tools does', () => {
    expect(monsterArt({ name: 'Goblin Boss', source: 'XMM', hasToken: true })).toBe(`${FIVE_IMG}/bestiary/tokens/XMM/Goblin%20Boss.webp`);
    expect(monsterArt({ name: 'Mûmak', source: 'XMM', hasToken: true })).toBe(`${FIVE_IMG}/bestiary/tokens/XMM/Mumak.webp`);
  });
  it('follows a borrowed token, and has none without one', () => {
    expect(monsterArt({ name: 'Goblin', source: 'XYZ', token: { name: 'Goblin Warrior', source: 'XMM' } })).toBe(`${FIVE_IMG}/bestiary/tokens/XMM/Goblin%20Warrior.webp`);
    expect(monsterArt({ name: 'Imp', source: 'XMM' })).toBe('');
  });
});
