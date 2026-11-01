/**
 * Taking a character out of the site as a text file, and bringing it back.
 *
 * The file is meant to be read by a person as well as by the importer, so the
 * long writing (notes, backstory) is stored as itself, in plain lines, rather
 * than as one escaped line of JSON. The numbers and lists are JSON, which is
 * how they are held everywhere else. A short summary at the top is for the
 * reader and is ignored on the way back in.
 *
 * Importing reads a file somebody else may have written, so it trusts nothing
 * in it: every field is checked and copied over a blank sheet, and anything
 * that is the wrong shape is left out and counted rather than let through.
 */
import { blankDefinition } from '$lib/sample';
import { PAGE_BREAK, joinPages, splitPages } from '$lib/rules/pages';
import {
  ABILITIES,
  SKILLS,
  TEXT_KEYS,
  emptyState,
  type Ability,
  type Definition,
  type RestKind,
  type SheetTexts,
  type State,
  type TextKey,
  type Tracker
} from '$lib/types';

export const FORMAT = 'dndcompanion-sheet';
export const VERSION = 1;
export const TITLE = 'DND Companion sheet';
/** A character is a few kilobytes; this is for the file someone picked by mistake. */
export const MAX_BYTES = 2 * 1024 * 1024;

export type ExportInput = {
  definition: Definition;
  state: State;
  /** Null when the database keeps the writing inside the definition. */
  texts: SheetTexts | null;
};

export type ImportedText = { body: string; isPublic: boolean };

export type Imported = {
  name: string;
  definition: Definition;
  state: State;
  texts: Record<TextKey, ImportedText>;
};

export type ImportResult =
  | { ok: true; value: Imported; warnings: string[] }
  | { ok: false; error: string };

// ── Writing ────────────────────────────────────────────────────────────────

const MARK = /^===== (DEFINITION|STATE|NOTES|BACKSTORY|SUMMARY|PAGE|END)(?: \[(private|shared)\])? =====$/;

/** A line of someone's writing that looks like a marker, or like an escape,
    gets a backslash, and loses it again on the way back in. */
const escapeLine = (line: string) => (line.startsWith('=====') || line.startsWith('\\') ? `\\${line}` : line);
const unescapeLine = (line: string) => (line.startsWith('\\') ? line.slice(1) : line);

/** Lines of one writing section, with page markers already turned into breaks. */
function readPages(lines: string[]): string {
  const pages: string[][] = [[]];
  for (const line of lines) {
    if (line === PAGE_BREAK) pages.push([]);
    else pages[pages.length - 1].push(unescapeLine(line));
  }
  return joinPages(pages.map((p) => p.join('\n')));
}

export function exportSheet(input: ExportInput, now: Date = new Date()): string {
  const { definition, state } = input;
  const texts: Record<TextKey, ImportedText> = {
    notes: input.texts
      ? { body: input.texts.notes.body, isPublic: input.texts.notes.isPublic }
      : { body: definition.notes ?? '', isPublic: true },
    backstory: input.texts
      ? { body: input.texts.backstory.body, isPublic: input.texts.backstory.isPublic }
      : { body: definition.backstory ?? '', isPublic: true }
  };
  // The writing travels in its own sections; leaving it in the definition too
  // would give the file two copies that could disagree.
  const { notes: _n, backstory: _b, ...rest } = definition;
  const body = { ...rest, notes: '' };

  const id = definition.identity ?? { name: '', level: 1 };
  const summary = [
    id.name || 'Unnamed character',
    [id.ancestry, id.class].filter(Boolean).join(' ') + (id.level ? ` · level ${id.level}` : ''),
    `HP ${state.hpCurrent} / ${definition.combat?.hpMax ?? '?'} · AC ${definition.combat?.ac ?? '?'}`
  ].filter((l) => l.trim());

  const out: string[] = [
    TITLE,
    `format: ${FORMAT}`,
    `version: ${VERSION}`,
    `exported: ${now.toISOString()}`,
    '',
    'A backup of one character. Import it from the sheet list on the site to',
    'get the character back as a new sheet. The sections below are read as they',
    'are, so change them with care; the summary is only for reading.',
    '',
    '===== SUMMARY =====',
    ...summary,
    '',
    '===== DEFINITION =====',
    ...JSON.stringify(body, null, 2).split('\n'),
    '',
    '===== STATE =====',
    ...JSON.stringify(state, null, 2).split('\n'),
    ''
  ];
  for (const key of TEXT_KEYS) {
    const text = texts[key];
    out.push(`===== ${key.toUpperCase()} [${text.isPublic ? 'shared' : 'private'}] =====`);
    // Pages are separated by a marker line of their own, so the file reads
    // like the book it is.
    splitPages(text.body).forEach((page, i) => {
      if (i > 0) out.push('===== PAGE =====');
      if (page !== '') out.push(...page.split('\n').map(escapeLine));
    });
    out.push('');
  }
  out.push('===== END =====', '');
  return out.join('\n');
}

export function exportFileName(definition: Definition): string {
  const slug = (definition.identity?.name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${slug || 'character'}.dndsheet.txt`;
}

// ── Reading ────────────────────────────────────────────────────────────────

type Plain = Record<string, unknown>;
const isObj = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number, min = -1e6, max = 1e6) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const optNum = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(1e6, Math.max(-1e6, v)) : undefined;

/** Copies only plain values: a nested object has no business in an entry. */
function flat(o: Plain): Plain {
  const out: Plain = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'string' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

class Tally {
  dropped = 0;
}

function entries(raw: unknown, tally: Tally, textKey: string): Plain[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    tally.dropped += 1;
    return [];
  }
  const out: Plain[] = [];
  for (const item of raw) {
    if (!isObj(item)) {
      tally.dropped += 1;
      continue;
    }
    const clean = flat(item);
    clean[textKey] = str(item[textKey]);
    out.push(clean);
  }
  return out;
}

const REST_ON = new Set(['short', 'long', 'dawn', 'manual']);

function trackers(raw: unknown, tally: Tally): Tracker[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    tally.dropped += 1;
    return [];
  }
  const out: Tracker[] = [];
  raw.forEach((item, i) => {
    if (!isObj(item)) {
      tally.dropped += 1;
      return;
    }
    const reset = isObj(item.reset) ? item.reset : {};
    const max = item.max;
    const t: Tracker = {
      id: str(item.id) || `imported-${i}`,
      label: str(item.label),
      max: typeof max === 'number' && Number.isFinite(max) ? max : typeof max === 'string' ? max : 1,
      type: item.type === 'gauge' ? 'gauge' : 'pips',
      direction: item.direction === 'accrue' ? 'accrue' : 'spend',
      reset: {
        on: (REST_ON.has(str(reset.on)) ? reset.on : 'manual') as RestKind | 'manual',
        amount:
          typeof reset.amount === 'number' && Number.isFinite(reset.amount)
            ? reset.amount
            : typeof reset.amount === 'string'
              ? reset.amount
              : 'full'
      }
    };
    for (const k of ['die', 'description', 'group', 'source', 'entryId', 'class'] as const) {
      if (typeof item[k] === 'string' && item[k] !== '') t[k] = item[k] as string;
    }
    out.push(t);
  });
  return out;
}

function booleans(raw: unknown, keys: readonly string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (isObj(raw)) for (const k of keys) if (raw[k] === true) out[k] = true;
  return out;
}

export function readDefinition(raw: unknown, tally = new Tally()): Definition {
  const src = isObj(raw) ? raw : {};
  const id = isObj(src.identity) ? src.identity : {};
  const name = str(id.name).trim() || 'Imported character';
  const def = blankDefinition(name);

  const identity: Plain = { ...flat(id), name, level: Math.max(1, Math.round(num(id.level, 1, 1, 30))) };
  if (Array.isArray(id.classes)) {
    identity.classes = id.classes.filter(isObj).map((c) => ({
      name: str(c.name),
      ...(str(c.subclass) ? { subclass: str(c.subclass) } : {}),
      level: Math.max(0, Math.round(num(c.level, 1, 0, 30))),
      ...(str(c.source) ? { source: str(c.source) } : {})
    }));
  }
  def.identity = identity as Definition['identity'];

  const ab = isObj(src.abilities) ? src.abilities : {};
  for (const a of ABILITIES) def.abilities[a] = Math.round(num(ab[a], 10, 0, 40));
  def.proficiency = Math.round(num(src.proficiency, 2, 0, 20));

  const combat = isObj(src.combat) ? src.combat : {};
  def.combat = {
    ac: Math.round(num(combat.ac, 10, 0, 99)),
    speed: Math.round(num(combat.speed, 30, 0, 999)),
    hpMax: Math.round(num(combat.hpMax, 1, 0, 99999)),
    hitDice: str(combat.hitDice, '1d8'),
    ...(optNum(combat.initiative) !== undefined ? { initiative: optNum(combat.initiative) } : {})
  };

  def.saves = booleans(src.saves, ABILITIES) as Definition['saves'];
  if (isObj(src.saveBonuses)) {
    const bonuses: Partial<Record<Ability, number>> = {};
    for (const a of ABILITIES) {
      const n = optNum(src.saveBonuses[a]);
      if (n !== undefined && n !== 0) bonuses[a] = n;
    }
    if (Object.keys(bonuses).length) def.saveBonuses = bonuses;
  }
  if (isObj(src.skills)) {
    for (const skill of Object.keys(SKILLS) as (keyof typeof SKILLS)[]) {
      const s = src.skills[skill];
      if (!isObj(s)) continue;
      const entry = booleans(s, ['proficient', 'expertise']);
      if (Object.keys(entry).length) def.skills[skill] = entry;
    }
  }

  def.attacks = entries(src.attacks, tally, 'name') as unknown as Definition['attacks'];
  def.features = entries(src.features, tally, 'title') as unknown as Definition['features'];
  if (Array.isArray(src.features)) {
    // A feature has a title and a body, both always text.
    def.features = def.features.map((f) => ({ ...f, body: str((f as Plain).body) }));
  }
  def.spells = entries(src.spells, tally, 'name') as unknown as Definition['spells'];
  def.equipment = entries(src.equipment, tally, 'name') as unknown as Definition['equipment'];
  def.trackers = trackers(src.trackers, tally);

  if (isObj(src.currency)) {
    for (const coin of ['cp', 'sp', 'ep', 'gp', 'pp'] as const) {
      const n = optNum(src.currency[coin]);
      if (n !== undefined) def.currency[coin] = Math.max(0, Math.round(n));
    }
  }
  if (isObj(src.traits)) {
    const traits: Plain = {};
    for (const [k, v] of Object.entries(src.traits)) if (typeof v === 'string') traits[k] = v;
    def.traits = traits as Definition['traits'];
  }
  if (typeof src.senses === 'string') def.senses = src.senses;
  if (ABILITIES.includes(src.spellcastingAbility as Ability)) {
    def.spellcastingAbility = src.spellcastingAbility as Ability;
  }
  for (const k of ['abilitySaveDc', 'spellSaveDc', 'spellAttackBonus'] as const) {
    const n = optNum(src[k]);
    if (n !== undefined) def[k] = n;
  }
  return def;
}

export function readState(raw: unknown): State {
  const src = isObj(raw) ? raw : {};
  const state = emptyState();
  state.hpCurrent = Math.round(num(src.hpCurrent, 0, 0, 99999));
  state.hpTemp = Math.round(num(src.hpTemp, 0, 0, 99999));
  state.hitDiceUsed = Math.round(num(src.hitDiceUsed, 0, 0, 999));
  state.inspiration = Math.round(num(src.inspiration, 0, 0, 99));
  if (isObj(src.trackers)) {
    for (const [k, v] of Object.entries(src.trackers)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) state.trackers[k] = Math.round(v);
    }
  }
  const ds = isObj(src.deathSaves) ? src.deathSaves : {};
  state.deathSaves = {
    successes: Math.round(num(ds.successes, 0, 0, 3)),
    failures: Math.round(num(ds.failures, 0, 0, 3))
  };
  if (Array.isArray(src.conditions)) {
    state.conditions = src.conditions
      .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
      .map((c) => c.trim().slice(0, 40));
  }
  return state;
}

function parseJson(text: string, what: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: `The ${what} section of that file could not be read. It may have been edited by hand.` };
  }
}

export function importSheet(input: string): ImportResult {
  const lines = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  if (lines[0]?.trim() !== TITLE) {
    return { ok: false, error: 'That is not a DND Companion sheet file.' };
  }

  // Header: "key: value" lines, up to the first section.
  const header: Record<string, string> = {};
  let at = 1;
  for (; at < lines.length && !MARK.test(lines[at]); at += 1) {
    const m = lines[at].match(/^([a-z]+): (.*)$/);
    if (m) header[m[1]] = m[2].trim();
  }
  if (header.format !== FORMAT) return { ok: false, error: 'That is not a DND Companion sheet file.' };
  const version = Number(header.version);
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'That file does not say which version of the format it is.' };
  }
  if (version > VERSION) {
    return { ok: false, error: 'That file was made by a newer version of the site. Update the site and try again.' };
  }

  // Sections: a marker line, then everything up to the next one.
  const sections = new Map<string, { lines: string[]; visibility?: string }>();
  let current: { lines: string[]; visibility?: string } | null = null;
  let ended = false;
  for (; at < lines.length; at += 1) {
    const m = lines[at].match(MARK);
    if (m) {
      if (m[1] === 'END') {
        ended = true;
        break;
      }
      if (m[1] === 'PAGE') {
        current?.lines.push(PAGE_BREAK);
        continue;
      }
      current = { lines: [], visibility: m[2] };
      // A section that appears twice is not trusted; the first one stands.
      if (!sections.has(m[1])) sections.set(m[1], current);
      continue;
    }
    current?.lines.push(lines[at]);
  }
  if (!ended) {
    return { ok: false, error: 'That file looks cut short: it has no end marker. Export it again.' };
  }

  const body = (name: string) => {
    const s = sections.get(name);
    if (!s) return null;
    // One blank line separates sections; it is not part of what was written.
    const l = [...s.lines];
    if (l.length && l[l.length - 1] === '') l.pop();
    return { lines: l, visibility: s.visibility };
  };

  const def = body('DEFINITION');
  if (!def) return { ok: false, error: 'That file has no character in it.' };
  const parsedDef = parseJson(def.lines.join('\n'), 'character');
  if (!parsedDef.ok) return parsedDef;
  if (!isObj(parsedDef.value) || !isObj(parsedDef.value.identity)) {
    return { ok: false, error: 'That file has no character in it.' };
  }

  const tally = new Tally();
  const definition = readDefinition(parsedDef.value, tally);

  let state = emptyState();
  const st = body('STATE');
  if (st) {
    const parsedState = parseJson(st.lines.join('\n'), 'state');
    if (!parsedState.ok) return parsedState;
    state = readState(parsedState.value);
  }

  const texts = {} as Record<TextKey, ImportedText>;
  for (const key of TEXT_KEYS) {
    const s = body(key.toUpperCase());
    texts[key] = s
      ? { body: readPages(s.lines), isPublic: s.visibility !== 'private' }
      : { body: '', isPublic: true };
  }
  // The note visitors read is taken from the writing's own marker, never
  // from the file's copy of it, so the two cannot disagree.
  delete definition.privateText;
  const privateKeys = TEXT_KEYS.filter((k) => !texts[k].isPublic);
  if (privateKeys.length) definition.privateText = Object.fromEntries(privateKeys.map((k) => [k, true]));

  const warnings: string[] = [];
  if (tally.dropped > 0) {
    warnings.push(
      `${tally.dropped} ${tally.dropped === 1 ? 'entry was' : 'entries were'} in a form the site could not read and ${tally.dropped === 1 ? 'was' : 'were'} left out.`
    );
  }
  return { ok: true, value: { name: definition.identity.name, definition, state, texts }, warnings };
}
