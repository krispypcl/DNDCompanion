import { describe, expect, it } from 'vitest';
import { PRESETS, buildPreset, presetsFor } from '$lib/rules/presets';
import { evaluateFormula } from '$lib/rules/formula';
import { trackerMax } from '$lib/rules/tracker';
import { formulaContext } from '$lib/rules/derived';
import { blankDefinition } from '$lib/sample';

describe('ready-made trackers', () => {
  it('puts the character’s own classes first', () => {
    const { yours, others } = presetsFor(['Fighter']);
    expect(yours.map((p) => p.id)).toEqual(expect.arrayContaining(['second-wind', 'action-surge', 'superiority', 'slots-fighter']));
    expect(others.some((p) => p.className === 'Fighter')).toBe(false);
  });

  it('every preset builds trackers whose formulas work at every level', () => {
    for (const p of PRESETS) {
      for (let lvl = 1; lvl <= 20; lvl++) {
        for (const t of p.build(lvl)) {
          const ctx = { level: lvl, classlevel: lvl, prof: 2, str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 2 };
          expect(() => evaluateFormula(t.max, ctx), `${p.id} at ${lvl}`).not.toThrow();
          expect(t.class).toBe(p.className);
        }
      }
    }
  });

  it('a wizard 5 gets 4, 3 and 2 slots', () => {
    const def = blankDefinition();
    def.identity.classes = [{ name: 'Wizard', level: 5 }];
    const trackers = buildPreset(PRESETS.find((p) => p.id === 'slots-wizard')!, 5, () => Math.random().toString(36));
    const ctx = formulaContext(def);
    expect(trackers.slice(0, 4).map((t) => trackerMax(t, ctx))).toEqual([4, 3, 2, 0]);
    expect(trackers[0].label).toBe('1st-Level Slots');
  });

  it('sets a level-dependent die for the level now', () => {
    const bardic = PRESETS.find((p) => p.id === 'bardic')!;
    expect(bardic.build(3)[0]).toMatchObject({ die: 'd6', reset: { on: 'long' } });
    expect(bardic.build(10)[0]).toMatchObject({ die: 'd10', reset: { on: 'short' } });
  });
});
