/**
 * What each of the sheet's tables shows: its columns, in order, with their
 * widths, placeholders and what can be pressed. Plain data, so the sheet's
 * component keeps to behaviour and layout.
 */
import { parseRoll } from '$lib/rules/dice';
import { spellDamage } from '$lib/rules/spellroll';
import type { Feature } from '$lib/types';

export const TABS = ['Combat', 'Equipment', 'Spells', 'Features', 'Trackers', 'Character', 'Notes', 'Backstory', 'Appearance'];

export const PASSIVES = ['perception', 'insight', 'investigation'] as const;

export const CLASS_COLUMNS = [
  { key: 'name', label: 'Class', width: '38%', placeholder: 'Class' },
  { key: 'subclass', label: 'Subclass', width: '30%', placeholder: 'Subclass' },
  { key: 'level', label: 'Level', width: '14%', type: 'number' as const, numeric: true, placeholder: '1' },
  { key: 'source', label: 'Source', width: '18%', muted: true, placeholder: 'xphb' }
];

export const ATTACK_COLUMNS = [
  { key: 'name', label: 'Name', width: '24%', placeholder: 'Longsword' },
  { key: 'bonus', label: 'Hit', width: '9%', numeric: true, placeholder: '+5',
    canPress: (v: unknown) => parseRoll(v, 'hit') !== null, pressVerb: 'Roll' },
  { key: 'damage', label: 'Damage', width: '14%', numeric: true, placeholder: '1d8 + 3',
    canPress: (v: unknown) => parseRoll(v, 'damage') !== null, pressVerb: 'Roll' },
  { key: 'damageType', label: 'Type', width: '12%', placeholder: 'slashing' },
  { key: 'notes', label: 'Notes', width: '41%', muted: true, wide: true, placeholder: 'Versatile (1d10)' }
];

/** Blank first: a new row has no level yet, and defaulting it to Cantrip
    would put a level on a spell nobody has written one for. */
const SPELL_LEVELS = ['', 'Cantrip', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
export const SPELL_COLUMNS = [
  { key: 'name', label: 'Name', width: '14%', placeholder: 'Shield' },
  { key: 'level', label: 'Level', width: '9%', options: SPELL_LEVELS },
  { key: 'time', label: 'Cast time', width: '9%', placeholder: '1 reaction' },
  { key: 'range', label: 'Range', width: '8%', placeholder: 'Self' },
  { key: 'components', label: 'Components', short: 'Comp', width: '7%', placeholder: 'V, S, M' },
  { key: 'duration', label: 'Duration', short: 'Dur.', width: '9%', placeholder: '1 round' },
  { key: 'save', label: 'Save', width: '7%', placeholder: 'DEX 13' },
  { key: 'damage', label: 'Roll', width: '12%', numeric: true, placeholder: '8d6 +1d6/level',
    canPress: (v: unknown) => spellDamage(v, null, null, 1) !== null, pressVerb: 'Cast',
    show: (v: unknown) => String(v ?? '').replace(/\s*(?:\/|per)\s*(?:slot\s*)?(?:level|lvl|slot)s?\b/i, '/lvl') },
  { key: 'notes', label: 'Notes', width: '18%', muted: true, wide: true, placeholder: '+5 AC' },
  { key: 'source', label: 'Source', short: 'Src', width: '7%', muted: true, placeholder: 'xphb' }
];

/** Attunement: three items at most, by the rules. */
export const ATTUNE_SLOTS = 3;

export const ITEM_COLUMNS = [
  { key: 'name', label: 'Item', width: '38%', placeholder: 'Longsword' },
  { key: 'qty', label: 'Amount', short: 'Qty', width: '12%', type: 'number' as const, numeric: true, placeholder: '1' },
  { key: 'weight', label: 'Weight', width: '12%', type: 'number' as const, numeric: true, placeholder: '3' },
  { key: 'value', label: 'Value', width: '22%', numeric: true, placeholder: '15 gp' },
  { key: 'source', label: 'Source', width: '16%', muted: true, placeholder: 'xphb' }
];

export const TRACKER_COLUMNS = [
  { key: 'label', label: 'Label', width: '15%', placeholder: 'Second Wind' },
  { key: 'max', label: 'Max', width: '12%', placeholder: '1 or classlevel' },
  { key: 'cls', label: 'From', width: '12%', placeholder: 'Fighter, Lucky' },
  { key: 'die', label: 'Die', width: '6%', placeholder: 'd10' },
  { key: 'type', label: 'Shape', width: '10%', options: ['pips', 'gauge'] as const },
  { key: 'direction', label: 'Direction', short: 'Dir.', width: '10%', options: ['spend', 'accrue'] as const },
  { key: 'resetOn', label: 'Resets on', short: 'Resets', width: '11%', options: ['manual', 'short', 'long', 'dawn'] as const },
  { key: 'resetAmount', label: 'Refill', width: '9%', placeholder: 'full' },
  { key: 'source', label: 'Source', short: 'Src', width: '15%', muted: true, placeholder: 'phb' }
];

/** Where a feature comes from, in the order the groups are listed. A
    feature with none written is under Other, last. */
export const FEATURE_KINDS = ['Class', 'Subclass', 'Species', 'Background', 'Feat', 'Fighting Style',
  'Weapon Mastery', 'Maneuver', 'Invocation', 'Metamagic', 'Item', 'Other'];
export const kindOf = (f: Feature) => (FEATURE_KINDS.includes(f.kind ?? '') ? f.kind! : 'Other');
export const FEATURE_COLUMNS = [
  { key: 'title', label: 'Title', width: '34%', placeholder: 'Second Wind' },
  { key: 'kind', label: 'Type', width: '13%', options: ['Other', ...FEATURE_KINDS.slice(0, -1)] },
  { key: 'body', label: 'Description', width: '40%', wide: true, placeholder: 'Regain 1d10 + level hit points' },
  { key: 'source', label: 'Source', width: '13%', muted: true, placeholder: 'phb' }
];
