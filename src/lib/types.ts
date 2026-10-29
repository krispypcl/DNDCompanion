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

/** `counter` was a third shape; it is read as a gauge now. */
export type TrackerType = 'pips' | 'gauge';
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
  /**
   * Which class this tracker belongs to, so `classlevel` in its formula means
   * that class's level rather than the character's total. Without it a
   * multiclassed character's class features silently inflate.
   */
  class?: string;
};

export type LinkableEntry = {
  name: string;
  source?: string;
  lookupUrl?: string;
  entryId?: string;
};

export type Attack = LinkableEntry & {
  bonus?: string;
  damage?: string;
  damageType?: string;
  notes?: string;
};
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
export type Item = LinkableEntry & { qty?: number; weight?: number; notes?: string };

/** The long-form character writing, kept apart from the one-line details. */
/** One class a character has levels in. A single-class character has one. */
export type ClassEntry = { name: string; subclass?: string; level: number };

export type Traits = {
  proficiencies?: string;
  allies?: string;
  appearance?: string;
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
};

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
    /**
     * Every class the character has levels in. Authoritative when present;
     * `class`, `subclass` and `level` above are the older single-class shape
     * and are kept in step so existing sheets and `level` formulas still work.
     */
    classes?: ClassEntry[];
    /** Descriptive details, all free text: a size is "Medium", an age may be
        "24" or "unknown", a height may be in feet or centimetres. */
    gender?: string;
    age?: string;
    size?: string;
    height?: string;
    weight?: string;
    faith?: string;
    skin?: string;
    eyes?: string;
    hair?: string;
  };
  abilities: Record<Ability, number>;
  proficiency: number;
  /** Unset for a character who casts nothing, which is most martials. */
  spellcastingAbility?: Ability;
  /** Written rather than derived: which ability a class feature's DC uses
      varies by feature, so there is nothing to compute it from. */
  abilitySaveDc?: number;
  /** Written too, since a subclass or item may change either. */
  spellSaveDc?: number;
  spellAttackBonus?: number;
  combat: { ac: number; speed: number; initiative?: number; hpMax: number; hitDice: string };
  /** Proficiency only; the flat bonuses below are separate. */
  saves: Partial<Record<Ability, boolean>>;
  /** Added to every saving throw: a Cloak of Protection, an aura. */
  saveBonusAll?: number;
  /** Added to one saving throw on top of the global bonus. */
  saveBonuses?: Partial<Record<Ability, number>>;
  skills: Partial<Record<SkillName, SkillProficiency>>;
  attacks: Attack[];
  features: Feature[];
  spells: Spell[];
  trackers: Tracker[];
  equipment: Item[];
  currency: Partial<Record<'cp' | 'sp' | 'ep' | 'gp' | 'pp', number>>;
  traits?: Traits;
  senses?: string;
  notes: string;
  backstory?: string;
};

export type State = {
  hpCurrent: number;
  hpTemp: number;
  hitDiceUsed: number;
  /** tracker id → how many are spent (or accrued, for accrue trackers) */
  trackers: Record<string, number>;
  deathSaves: { successes: number; failures: number };
  conditions: string[];
  /** Spent and earned mid-session, so it lives with play state. */
  inspiration?: number;
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
  conditions: [],
  inspiration: 0
});
