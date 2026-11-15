/**
 * What goes in each box of the exported PDF, worked out from the sheet the
 * same way the screen works it out (rules/derived and friends). Pure: no
 * drawing here, so every value can be tested; sheetPdf.ts lays it out.
 */
import { spellAttack, spellDc } from '$lib/rules/casting';
import {
  armorClass,
  classList,
  initiativeParts,
  modifierOf,
  passiveScore,
  proficiencyBonus,
  saveBonus,
  skillTotal,
  speedParts,
  weightCarried
} from '$lib/rules/derived';
import { abilityScoreParts, advantageFrom } from '$lib/rules/equipment';
import { countedForPrint, spellBlocks } from '$lib/rules/print';
import { INK_MARK } from '$lib/rules/richtext';
import { PAGE_BREAK } from '$lib/rules/pages';
import { needsConcentration, ordinal } from '$lib/rules/spells';
import { ABILITIES, SKILLS, type Ability, type Definition, type Item, type SkillName, type State } from '$lib/types';

export const ABILITY_NAMES: Record<Ability, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
};
export const SKILL_NAMES: Record<SkillName, string> = {
  acrobatics: 'Acrobatics', animalHandling: 'Animal Handling', arcana: 'Arcana', athletics: 'Athletics',
  deception: 'Deception', history: 'History', insight: 'Insight', intimidation: 'Intimidation',
  investigation: 'Investigation', medicine: 'Medicine', nature: 'Nature', perception: 'Perception',
  performance: 'Performance', persuasion: 'Persuasion', religion: 'Religion',
  sleightOfHand: 'Sleight of Hand', stealth: 'Stealth', survival: 'Survival'
};

/** Proficient and expert, as the little circle on the sheet shows them (and a reader can type over). */
export const PROF = '●';
export const EXPERT = '◆';

export const signed = (n: number | null | undefined): string => (n == null || !Number.isFinite(n) ? '' : n >= 0 ? `+${n}` : `${n}`);
const text = (v: unknown): string => (v == null ? '' : String(v).trim());
const num = (v: unknown): string => (v == null || v === '' || !Number.isFinite(Number(v)) ? '' : String(Number(v)));

/**
 * Notes and backstory as plain lines: the formatting marks dropped (the
 * words kept), drawings left out, headings in capitals, pages run on.
 */
export function plainText(body: string | null | undefined): string {
  return String(body ?? '')
    .split(PAGE_BREAK)
    .map((page) =>
      page
        .split('\n')
        .filter((line) => !line.startsWith(INK_MARK))
        .map((line) => {
          let l = line.replace(/\[\[[chs]:[a-z]+\|((?:(?!\[\[)[^])*?)\]\]/g, '$1');
          l = l.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/~~(.+?)~~/g, '$1').replace(/(^|[^*\\])\*(?!\s)(.+?)\*/g, '$1$2');
          l = l.replace(/\\([*_~[\]\\#-])/g, '$1');
          const h = l.match(/^#{1,3}\s+(.*)$/);
          if (h) return h[1].toUpperCase();
          return l.replace(/^(\s*)[-*]\s+/, '$1• ');
        })
        .join('\n')
        .trim()
    )
    .filter(Boolean)
    .join('\n\n');
}

export type Paragraph = { head?: string; title?: string; body?: string };

/** "Class" → CLASS FEATURES, "Feat" → FEATS, "Weapon Mastery" → WEAPON MASTERIES. */
export function groupTitle(kind: string): string {
  const k = kind.trim();
  if (/^(class|subclass|species|race|background|racial|ancestry)$/i.test(k)) return `${k.toUpperCase()} FEATURES`;
  if (/features?$|traits?$/i.test(k)) return k.toUpperCase().replace(/(FEATURE|TRAIT)$/, '$1S');
  if (/y$/i.test(k)) return k.toUpperCase().replace(/Y$/, 'IES');
  if (/(s|ic)$/i.test(k)) return k.toUpperCase();
  return `${k.toUpperCase()}S`;
}

export type SheetContent = ReturnType<typeof sheetContent>;

/** Everything the four pages hold. */
export function sheetContent(def: Definition, state: State, opts: { notes?: string } = {}) {
  const id = def.identity ?? ({} as Definition['identity']);
  const classes = classList(def);
  const classAndLevel = classes.length
    ? classes.map((c) => [c.subclass, c.name, c.level].filter((x) => x !== undefined && x !== '').join(' ')).join(' / ')
    : `Level ${id.level ?? 1}`;

  const abilities = ABILITIES.map((a) => ({
    key: a,
    name: ABILITY_NAMES[a],
    score: String(abilityScoreParts(def, a).score),
    mod: signed(modifierOf(def, a))
  }));
  const saves = ABILITIES.map((a) => ({ key: a, name: ABILITY_NAMES[a], prof: def.saves?.[a] ? PROF : '', value: signed(saveBonus(def, a)) }));
  const skills = (Object.keys(SKILLS) as SkillName[]).map((s) => {
    const p = def.skills?.[s];
    return {
      key: s,
      name: SKILL_NAMES[s],
      ability: SKILLS[s].toUpperCase(),
      prof: p?.expertise ? EXPERT : p?.proficient ? PROF : '',
      value: signed(skillTotal(def, s))
    };
  });

  // Saving throw notes: advantage and flat bonuses from what is worn or known.
  const onEvery = advantageFrom(def, 'save');
  const saveNotes: string[] = onEvery.length ? [`Advantage on all saves (${onEvery.join(', ')})`] : [];
  for (const a of ABILITIES) {
    const from = advantageFrom(def, 'save', a).filter((f) => !onEvery.includes(f));
    if (from.length) saveNotes.push(`Advantage on ${ABILITY_NAMES[a]} saves (${from.join(', ')})`);
  }
  for (const a of ABILITIES) {
    const b = Number(def.saveBonuses?.[a]) || 0;
    if (b) saveNotes.push(`${signed(b)} to ${ABILITY_NAMES[a]} saves`);
  }
  const saveModifiers = saveNotes.join('\n');

  const ac = armorClass(def);
  const defenses = ac.parts
    .filter((p) => p.note === 'armor' || (p.label !== 'Dexterity' && p.label !== 'Dexterity (up to +2)' && p.label !== 'Unarmored'))
    .map((p) => (p.note === 'armor' ? `${p.label} (${p.value} + DEX)` : `${p.label} (${signed(p.value)} AC)`))
    .join('\n');

  const speed = speedParts(def);
  const initAdv = advantageFrom(def, 'init');

  const counted = countedForPrint(def, state);
  const resources = counted.resources.map((r) => {
    const left = Math.max(0, r.max - r.used);
    return `${r.label}${r.die ? ` (${r.die})` : ''}: ${left} of ${r.max}${r.reset ? `, back on a ${r.reset.toLowerCase()}` : ''}`;
  });

  const COMBAT_KINDS = ['Maneuver', 'Weapon Mastery', 'Fighting Style', 'Feat', 'Invocation', 'Metamagic'];
  const combat = COMBAT_KINDS.map((kind) => ({
    kind,
    names: (def.features ?? []).filter((f) => f.kind === kind && text(f.title || f.name)).map((f) => text(f.title || f.name))
  })).filter((g) => g.names.length);

  // Weapon attacks first; then cantrips that roll damage, as the paper sheet has them.
  const attackRows = (def.attacks ?? []).map((a) => ({
    name: text(a.name),
    hit: text(a.bonus),
    damage: [text(a.damage), text(a.damageType)].filter(Boolean).join(' '),
    notes: text(a.notes)
  }));
  const cantripRows = (def.spells ?? [])
    .filter((s) => /^(cantrip|0)$/i.test(text(s.level)) && text(s.damage))
    .map((s) => ({ name: text(s.name), hit: text(s.save), damage: text(s.damage), notes: text(s.notes) }));
  const attacks = [...attackRows, ...cantripRows];

  // Features, grouped by where they come from, in the order they first appear.
  const groups = new Map<string, Paragraph[]>();
  for (const f of def.features ?? []) {
    if (!text(f.title || f.name) && !text(f.body)) continue;
    const kind = text(f.kind) || 'Features';
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind)!.push({ title: text(f.title || f.name), body: text(f.body) });
  }
  const features: Paragraph[] = [];
  for (const [kind, list] of groups) {
    features.push({ head: groupTitle(kind) });
    features.push(...list);
  }
  if (resources.length) {
    features.push({ head: 'LIMITED USES' }, ...resources.map((r) => ({ body: r })));
  }

  const coins = (['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((c) => ({ key: c, value: num(def.currency?.[c]) || '0' }));
  const strength = abilityScoreParts(def, 'str').score;
  const carried = weightCarried(def);
  const capacity = strength * 15;
  const itemRow = (it: Item) => ({ name: text(it.name) + (it.equipped ? ' (equipped)' : ''), qty: num(it.qty) || '1', weight: it.weight != null && it.weight !== ('' as unknown) ? `${num(it.weight)} lb` : '' });
  const attuned = (def.equipment ?? []).filter((it) => it.attuned && text(it.name)).map(itemRow);
  const items = (def.equipment ?? []).filter((it) => !it.attuned && text(it.name)).map(itemRow);

  const t = def.traits ?? {};
  const profLang = [
    t.proficiencies ? `PROFICIENCIES\n${text(t.proficiencies)}` : '',
    t.languages ? `LANGUAGES\n${text(t.languages)}` : ''
  ].filter(Boolean).join('\n\n');

  const blocks = spellBlocks(def, counted.slots);
  const spellRows: { kind: 'head' | 'spell'; cells: string[] }[] = [];
  for (const b of blocks) {
    const slots = b.slots ? `  ·  ${b.slots.max} slot${b.slots.max === 1 ? '' : 's'}${b.slots.used ? `, ${b.slots.used} spent` : ''}` : '';
    const title = b.level === 0 ? 'Cantrips' : b.level ? `${ordinal(b.level)} Level` : b.title;
    spellRows.push({ kind: 'head', cells: [`${title}${slots}`] });
    for (const s of b.spells) {
      const conc = needsConcentration(s.duration, s.notes);
      spellRows.push({
        kind: 'spell',
        cells: [
          b.level === 0 || s.prepared ? PROF : '',
          text(s.name),
          text(s.source),
          text(s.save),
          text(s.time),
          text(s.range),
          text(s.components),
          [text(s.duration), conc && !/conc/i.test(text(s.duration)) ? 'Conc.' : ''].filter(Boolean).join(', '),
          '',
          [text(s.damage), text(s.notes)].filter(Boolean).join('. ')
        ]
      });
    }
  }
  const casting = def.spellcastingAbility;

  return {
    name: text(id.name) || 'Unnamed hero',
    classAndLevel,
    player: text(id.player),
    species: text(id.ancestry),
    background: text(id.background),
    xp: '',
    abilities,
    saves,
    saveModifiers,
    skills,
    passives: [
      { label: 'Passive Wisdom (Perception)', value: String(passiveScore(def, 'perception')) },
      { label: 'Passive Wisdom (Insight)', value: String(passiveScore(def, 'insight')) },
      { label: 'Passive Intelligence (Investigation)', value: String(passiveScore(def, 'investigation')) }
    ],
    senses: text(def.senses),
    initiative: signed(initiativeParts(def).total),
    initiativeNote: initAdv.length ? 'Advantage' : '',
    ac: String(ac.total),
    defenses,
    inspiration: state.inspiration ? String(state.inspiration) : '',
    proficiency: signed(proficiencyBonus(def)),
    abilitySaveDc: num(def.abilitySaveDc),
    speed: `${speed.total} ft. (Walking)`,
    hpMax: num(def.combat?.hpMax),
    hpCurrent: num(state.hpCurrent),
    hpTemp: state.hpTemp ? num(state.hpTemp) : '',
    hitDiceTotal: text(def.combat?.hitDice),
    hitDiceLeft: state.hitDiceUsed ? `${state.hitDiceUsed} spent` : '',
    deathSaves: { successes: state.deathSaves?.successes ?? 0, failures: state.deathSaves?.failures ?? 0 },
    profLang,
    actions: [
      resources.length ? `LIMITED USES\n${resources.join('\n')}` : '',
      state.conditions?.length ? `CONDITIONS\n${state.conditions.join(', ')}` : ''
    ].filter(Boolean).join('\n\n'),
    actionsMore: combat.map((g) => `${groupTitle(g.kind)}\n${g.names.join('\n')}`).join('\n\n'),
    attacks,
    features,
    coins,
    weightCarried: carried ? `${carried} lb` : '0 lb',
    encumbered: carried > capacity ? 'Yes' : 'No',
    pushDragLift: `${strength * 30} lb`,
    items,
    attuned,
    details: {
      gender: text(id.gender), age: text(id.age), size: text(id.size), height: text(id.height), weight: text(id.weight),
      alignment: text(id.alignment), faith: text(id.faith), skin: text(id.skin), eyes: text(id.eyes), hair: text(id.hair)
    },
    portraitUrl: text(id.portraitUrl),
    appearance: text(t.appearance),
    allies: text(t.allies),
    personality: text(t.personality),
    ideals: text(t.ideals),
    bonds: text(t.bonds),
    flaws: text(t.flaws),
    notes: plainText(opts.notes ?? ''),
    spellcastingClass: classes.map((c) => c.name).filter(Boolean).join(' / '),
    spellcastingAbility: casting ? casting.toUpperCase() : '',
    spellSaveDc: num(spellDc(def)),
    spellAttack: spellAttack(def) != null ? signed(spellAttack(def)) : '',
    spellRows,
    hasSpells: spellRows.length > 0 || Boolean(casting),
    theme: id.theme
  };
}
