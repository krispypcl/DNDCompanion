/** Shared types. `definition` is the character as written; `state` is what moves during play. */

export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const SKILLS = {
  acrobatics: 'dex',
  animalHandling: 'wis',
  arcana: 'int',
  athletics: 'str',
  deception: 'cha',
  history: 'int',
  insight: 'wis',
  intimidation: 'cha',
  investigation: 'int',
  medicine: 'wis',
  nature: 'int',
  perception: 'wis',
  performance: 'cha',
  persuasion: 'cha',
  religion: 'int',
  sleightOfHand: 'dex',
  stealth: 'dex',
  survival: 'wis'
} as const satisfies Record<string, Ability>;

export type SkillName = keyof typeof SKILLS;

export type SkillProficiency = { proficient?: boolean; expertise?: boolean };

export type TrackerType = 'pips' | 'counter' | 'gauge';
export type TrackerDirection = 'spend' | 'accrue';
export type RestKind = 'short' | 'long' | 'dawn';

export type Tracker = {
  id: string;
  label: string;
  description?: string;
  /** A number, or a formula over level / prof / ability modifiers. */
  max: number | string;
  /** Rendered on the pips, e.g. "d8". Display only. */
  die?: string;
  type: TrackerType;
  direction: TrackerDirection;
  reset: { on: RestKind | 'manual'; amount: 'full' | number | string };
  group?: string;
  source?: string;
  entryId?: string;
};

export type LinkableEntry = {
  name: string;
  source?: string;
  lookupUrl?: string;
  entryId?: string;
};

export type Attack = LinkableEntry & { bonus?: string; damage?: string; notes?: string };
export type Feature = LinkableEntry & { title: string; body: string };
export type Spell = LinkableEntry & {
  save?: string;
  time?: string;
  range?: string;
  components?: string;
  duration?: string;
  notes?: string;
  prepared?: boolean;
};
export type Item = LinkableEntry & { qty?: number; weight?: string; notes?: string };

export type Definition = {
  identity: {
    name: string;
    class?: string;
    subclass?: string;
    level: number;
    ancestry?: string;
    background?: string;
    player?: string;
    alignment?: string;
    portraitUrl?: string;
    lookupUrl?: string;
    /** A theme name from src/lib/theme.ts; anything else falls back. */
    theme?: string;
  };
  abilities: Record<Ability, number>;
  proficiency: number;
  combat: { ac: number; speed: number; initiative?: number; hpMax: number; hitDice: string };
  saves: Partial<Record<Ability, boolean>>;
  skills: Partial<Record<SkillName, SkillProficiency>>;
  attacks: Attack[];
  features: Feature[];
  spells: Spell[];
  trackers: Tracker[];
  equipment: Item[];
  currency: Partial<Record<'cp' | 'sp' | 'ep' | 'gp' | 'pp', number>>;
  notes: string;
};

export type State = {
  hpCurrent: number;
  hpTemp: number;
  hitDiceUsed: number;
  /** tracker id → how many are spent (or accrued, for accrue trackers) */
  trackers: Record<string, number>;
  deathSaves: { successes: number; failures: number };
  conditions: string[];
};

export type Sheet = {
  id: string;
  owner_id: string;
  campaign_id: string | null;
  name: string;
  retired: boolean;
  definition: Definition;
  state: State;
  created_at: string;
  updated_at: string;
};

export const emptyState = (): State => ({
  hpCurrent: 0,
  hpTemp: 0,
  hitDiceUsed: 0,
  trackers: {},
  deathSaves: { successes: 0, failures: 0 },
  conditions: []
});
