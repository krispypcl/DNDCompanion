import { describe, expect, it } from 'vitest';
import { indexClassFile } from '$lib/rules/brewClasses';
import { featureUrl, registerClassData } from '$lib/rules/lookup';

// A homebrew class file, cut down to what the links need.
const file = {
  class: [{
    name: 'Gunslinger', source: 'ValdaGunslinger',
    classFeatures: [
      'Fighting Style|Gunslinger|ValdaGunslinger|1', 'Quick Draw|Gunslinger|ValdaGunslinger|1',
      'Risk|Gunslinger|ValdaGunslinger|2',
      { classFeature: 'Gunslinger Subclass|Gunslinger|ValdaGunslinger|3', gainSubclassFeature: true },
      { classFeature: 'Subclass Feature|Gunslinger|ValdaGunslinger|6', gainSubclassFeature: true }
    ]
  }],
  subclassFeature: [
    { name: 'White Hat', className: 'Gunslinger', classSource: 'ValdaGunslinger', subclassShortName: 'White Hat', subclassSource: 'ValdaGunslinger', level: 3 },
    { name: 'Steely-Eyed Aura', className: 'Gunslinger', classSource: 'ValdaGunslinger', subclassShortName: 'White Hat', subclassSource: 'ValdaGunslinger', level: 3 }
  ]
};

describe('homebrew class links', () => {
  it('indexes a class file as the published ones are', () => {
    const idx = indexClassFile(file);
    expect(idx.classes['gunslinger|valdagunslinger'].risk).toBe('1-0');
    expect(idx.gains['gunslinger|valdagunslinger']).toEqual({ 3: '2-0', 6: '5-0' });
    expect(idx.subclassFeatures['steely-eyed aura']).toBe('gunslinger|valdagunslinger|white hat|valdagunslinger|3');
  });

  it('links a homebrew subclass feature to its place once the class is known', () => {
    registerClassData(indexClassFile(file));
    const classes = [{ name: 'Gunslinger', subclass: 'White Hat', level: 5, source: "GC:VSS'24" }, { name: 'Fighter', level: 2 }];
    expect(featureUrl({ title: 'Steely-Eyed Aura', kind: 'Subclass' }, {}, classes))
      .toBe('https://5e.tools/classes.html#gunslinger_valdagunslinger,state:feature=s2-0~sub_white%20hat_valdagunslinger=b1');
    expect(featureUrl({ title: 'Risk', kind: 'Class' }, {}, classes))
      .toBe('https://5e.tools/classes.html#gunslinger_valdagunslinger,state:feature=s1-0');
  });
});
