import { describe, expect, it } from 'vitest';
import { orderSheets, parseLink, readCampaign, roomValue } from '#lib/owlbear/links.ts';
import { toHex } from '#lib/owlbear/color.ts';
import { diceLine, headline, natural, noteOf, readNote } from '#lib/owlbear/rolls.ts';
import { partsFor, sameParts, tokenBox } from '#lib/owlbear/layout.ts';
import { blankDefinition, blankState } from '#lib/sample.ts';
import type { Sheet } from '#lib/types.ts';

const ID = '5d56a019-eee3-48b6-98e1-b086f585ec30';

describe('parseLink', () => {
  it.each([
    [`https://dndcompanion.krispypcl.workers.dev/DNDCompanion/s/${ID}`, 'sheet'],
    [`https://dndcompanion.krispypcl.workers.dev/DNDCompanion/s?id=${ID}`, 'sheet'],
    [`https://krispypcl.github.io/DNDCompanion/s/${ID}#appearance`, 'sheet'],
    [`https://dndcompanion.krispypcl.workers.dev/DNDCompanion/c/${ID}`, 'campaign'],
    [`/DNDCompanion/c/${ID}/`, 'campaign'],
    [ID.toUpperCase(), 'campaign']
  ])('reads %s', (text, kind) => expect(parseLink(text)).toEqual({ kind, id: ID }));

  it.each(['', 'hello', 'https://example.com/', `https://x.com/join?code=abc`, `/s/not-an-id`])('refuses %s', (t) =>
    expect(parseLink(t)).toBeNull()
  );
});

describe('the room’s campaign', () => {
  const c1 = '11111111-1111-4111-8111-111111111111';
  const c2 = '22222222-2222-4222-8222-222222222222';
  it('reads the latest campaign, leaving characters added on their own behind', () => {
    expect(readCampaign([{ kind: 'campaign', id: c1 }, { kind: 'sheet', id: ID }, { kind: 'campaign', id: c2 }])).toBe(c2);
    expect(readCampaign([{ kind: 'sheet', id: ID }, { kind: 'campaign', id: 'nope' }, null])).toBeNull();
    expect(readCampaign('nope')).toBeNull();
  });
  it('stores one campaign, in the shape rooms have always kept', () => {
    expect(roomValue(c1)).toEqual([{ kind: 'campaign', id: c1 }]);
    expect(readCampaign(roomValue(c1))).toBe(c1);
  });
  it('orders characters by the room, then the campaign, then by name', () => {
    const s = (id: string, name: string) => ({ id, name });
    const list = [s('a', 'Zed'), s('b', 'Amy'), s('c', 'Bo'), s('d', 'Cy')];
    expect(orderSheets(list, ['c'], ['d', 'a']).map((x) => x.id)).toEqual(['c', 'd', 'a', 'b']);
  });
});

describe('toHex', () => {
  it('turns oklch into sRGB hex and keeps hex', () => {
    expect(toHex('#ABC')).toBe('#aabbcc');
    expect(toHex('#12ab34')).toBe('#12ab34');
    expect(toHex('oklch(100% 0 0)')).toBe('#ffffff');
    expect(toHex('oklch(0% 0 0)')).toBe('#000000');
    // A red: mostly red channel.
    const red = toHex('oklch(60% 0.21 25)');
    expect(parseInt(red.slice(1, 3), 16)).toBeGreaterThan(180);
    expect(parseInt(red.slice(3, 5), 16)).toBeLessThan(90);
    expect(toHex('blue', '#000001')).toBe('#000001');
  });
});

describe('roll notes', () => {
  const roll = { pool: { dice: { 20: 1 }, modifier: 4, mode: 'advantage' as const }, dice: [{ sides: 20 as const, value: 20, dropped: 7 }], total: 24, formula: '1d20+4', at: 1000, label: 'Stealth' };
  it('says who rolled what', () => {
    const n = noteOf(roll, ID, 'Loka');
    expect(headline(n)).toBe('Loka rolled Stealth: 24 (natural 20!)');
    expect(diceLine(n)).toBe('1d20+4 with advantage · 20 (7)');
    expect(natural({ ...n, dice: [{ s: 20, v: 1 }] })).toBe('fumble');
  });
  it('reads a note off the wire, refusing anything else', () => {
    const n = noteOf(roll, ID, 'Loka');
    expect(readNote(JSON.parse(JSON.stringify(n)))).toEqual(n);
    expect(readNote({ nope: 1 })).toBeNull();
    expect(headline({ ...n, dice: [{ s: 20, v: 1 }] })).toBe('Loka rolled Stealth: 24 (natural 1!)');
  });
});

describe('token parts', () => {
  const sheet = (hp: number, max: number, temp = 0, conditions: string[] = []): Sheet => {
    const definition = blankDefinition();
    definition.combat.hpMax = max as never;
    return { id: ID, owner_id: 'o', name: 'L', campaign_id: null, retired: false, created_at: '', updated_at: '', definition,
      state: { ...blankState(), hpCurrent: hp, hpTemp: temp, conditions } } as unknown as Sheet;
  };
  it('measures the token from its image, grid and scale', () => {
    const box = tokenBox({ position: { x: 100, y: 100 }, scale: { x: 2, y: 2 }, image: { width: 300, height: 300 }, grid: { dpi: 300, offset: { x: 150, y: 150 } } }, 150);
    expect(box).toEqual({ x: -50, y: -50, w: 300, h: 300 });
  });
  it('draws the bar to scale, the temp above it, and a dot per colored condition', () => {
    const box = { x: 0, y: 0, w: 100, h: 100 };
    const parts = partsFor(box, sheet(5, 10, 3, ['Poisoned', 'Prone']));
    const back = parts.find((p) => p.kind === 'hp-back')!;
    const fill = parts.find((p) => p.kind === 'hp-fill')!;
    expect(fill.w).toBeCloseTo(back.w / 2);
    expect(parts.find((p) => p.kind === 'hp-temp')!.y).toBeLessThan(back.y);
    expect(parts.filter((p) => p.shape === 'CIRCLE')).toHaveLength(2);
    expect(sameParts(fill, { ...fill, x: fill.x + 0.1 })).toBe(true);
    expect(sameParts(fill, { ...fill, w: fill.w + 3 })).toBe(false);
  });
  it('leaves the fill out at 0 and the bar out with no maximum', () => {
    expect(partsFor({ x: 0, y: 0, w: 100, h: 100 }, sheet(0, 10)).some((p) => p.kind === 'hp-fill')).toBe(false);
    expect(partsFor({ x: 0, y: 0, w: 100, h: 100 }, sheet(0, 0))).toEqual([]);
  });
});

describe('creature tokens', async () => {
  const { partsForVitals, vitalsOfCreature } = await import('#lib/owlbear/layout.ts');
  const box = { x: 0, y: 0, w: 100, h: 100 };
  const c = (over: Record<string, unknown> = {}) => ({ visible: true, hp_max: 20, hp_current: 20, conditions: [] as string[], ...over });
  it('shows nothing until the DM reveals it', () => {
    expect(vitalsOfCreature(c({ visible: false }))).toBeNull();
  });
  it('shows only how hurt it looks, never its numbers', () => {
    const fill = (v: ReturnType<typeof vitalsOfCreature>) => partsForVitals(box, v!).find((p) => p.kind === 'hp-fill')?.w ?? 0;
    const full = fill(vitalsOfCreature(c()));
    expect(fill(vitalsOfCreature(c({ hp_current: 19 })))).toBe(full);
    expect(fill(vitalsOfCreature(c({ hp_current: 9 })))).toBeCloseTo(full / 2);
    expect(fill(vitalsOfCreature(c({ hp_current: 4 })))).toBeCloseTo(full / 4);
    expect(fill(vitalsOfCreature(c({ hp_current: 0 })))).toBe(0);
  });
  it('has no bar without hit points, but keeps its condition dots', () => {
    const parts = partsForVitals(box, vitalsOfCreature(c({ hp_max: null, conditions: ['Prone'] }))!);
    expect(parts.some((p) => p.kind.startsWith('hp'))).toBe(false);
    expect(parts.some((p) => p.kind === 'cond-0')).toBe(true);
  });
});
