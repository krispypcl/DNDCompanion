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
export type Feature = LinkableEntry & {
  title: string;
  body: string;
  /** Where it comes from: Class, Subclass, Species, Background, Feat… The
      features list is grouped by it. */
  kind?: string;
};
export type Spell = LinkableEntry & {
  /** 'Cantrip' or '1'–'10', as written: a free-form string so a homebrew
      level above ninth is not a schema change. */
  level?: string;
  save?: string;
  time?: string;
  range?: string;
  components?: string;
  duration?: string;
  notes?: string;
  prepared?: boolean;
  /** Its damage or healing roll; "+1d6/level" after it is what each slot
      level above its own adds. See rules/spellroll.ts. */
  damage?: string;
};
export type Item = LinkableEntry & {
  qty?: number;
  /** Attuned to the character; attuned items are listed first. */
  attuned?: boolean;
  weight?: number;
  /** Written as the player likes ("15 gp", "priceless"), so it is text and
      is never summed. */
  value?: string;
  notes?: string;
  /** Worn or held: its effects count (armour on, shield up, ring worn). */
  equipped?: boolean;
  /** What it does to the character while equipped. */
  effects?: ItemEffect[];
};

/** Something an equipped item does to the numbers. */
export type ItemEffect =
  | { kind: 'armor'; base: number; dex: 'full' | 'max2' | 'none' }
  | { kind: 'shield'; bonus: number }
  | { kind: 'ac'; bonus: number }
  | { kind: 'speed'; bonus: number }
  | { kind: 'init'; bonus: number }
  | { kind: 'save'; ability: Ability | 'all'; bonus: number }
  | { kind: 'ability'; ability: Ability; mode: 'set' | 'bonus'; value: number };

/** The long-form character writing, kept apart from the one-line details. */
/** One class a character has levels in. A single-class character has one. */
export type ClassEntry = { name: string; subclass?: string; level: number; source?: string };

export type Traits = {
  /** Armour, weapons, tools and saving throws. Languages are separate: a
      sheet written before they were split keeps both here. */
  proficiencies?: string;
  languages?: string;
  allies?: string;
  appearance?: string;
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
};

export type ConditionMotion = 'still' | 'pulse' | 'shimmer' | 'heavy' | 'shiver' | 'daze';
export type ConditionLook = { color: string; motion: ConditionMotion; low?: boolean };

export type Definition = {
  identity: {
    name: string;
    class?: string;
    subclass?: string;
    level: number;
    ancestry?: string;
    /** The book the species and background are from, for their 5e.tools links. */
    ancestrySource?: string;
    background?: string;
    backgroundSource?: string;
    player?: string;
    alignment?: string;
    portraitUrl?: string;
    /** A wide image behind the sheet, shown as a diagonal band. Optional:
        without it the sheet looks exactly as it did. */
    bannerUrl?: string;
    lookupUrl?: string;
    /** The campaign the character plays in, shown beside the name. Free text
        until campaigns are their own records. */
    campaign?: string;
    /** A YouTube (or YouTube Music) playlist or video that plays on the sheet. */
    playlistUrl?: string;
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
  /** A flat bonus on one saving throw, beyond modifier and proficiency. */
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
  /** Left empty once the sheet's text lives in `Sheet.texts`; read only by
      sheets saved before that, and by a database that has no table for it. */
  notes: string;
  backstory?: string;
  /** How a condition that is not one of the standard ones tints the screen,
      by its name in lower case. A blank colour means no tint. */
  conditionLooks?: Record<string, ConditionLook>;
  /** Which writings are private. The writing itself is kept from visitors by
      the database; this copy, on the public row, is only so a visitor can be
      told it is private rather than shown an empty page. */
  privateText?: Partial<Record<TextKey, boolean>>;
  /** The player's own links (a map, a wiki, a character builder), on the Links tab. */
  links?: { label: string; url: string }[];
  /** Sound effects swapped for recordings, by effect (see SOUND_NAMES in sound.ts). */
  sounds?: Partial<Record<string, string>>;
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

/** The two long-form writings. They live apart from the definition so that
    one of them can be private: a sheet's own row is readable by anyone with
    its link, and a hidden field in a readable row is not hidden. */
export type TextKey = 'notes' | 'backstory';
export const TEXT_KEYS: TextKey[] = ['notes', 'backstory'];

export type TextEntry = {
  body: string;
  /** Anyone with the link may read it; otherwise only the owner can. */
  isPublic: boolean;
  /** When this copy was last saved, for the same lost-update guard the rest of
      the sheet has. Null until it has been saved once. */
  updatedAt: string | null;
};
export type SheetTexts = Record<TextKey, TextEntry>;

export const blankTexts = (): SheetTexts => ({
  notes: { body: '', isPublic: true, updatedAt: null },
  backstory: { body: '', isPublic: true, updatedAt: null }
});

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
  /**
   * Notes and backstory, with who may read them. Null when the database has
   * not been given the table for them yet, in which case both are still in
   * the definition and neither can be made private.
   */
  texts?: SheetTexts | null;
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
