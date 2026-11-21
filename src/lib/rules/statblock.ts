/**
 * A creature's stat block, in the app's own simple form: the DM writes one
 * for a homebrew monster or NPC, and a monster from 5e.tools is turned into
 * one when it is added to the table. Every text is plain text; it becomes
 * HTML only in `statBlockHtml`, escaped, so it is safe to show.
 */
import { inline } from './fiveRender.ts';
import type { Raw } from './fiveData.ts';

export type Feature = { name: string; text: string };
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = (typeof ABILITIES)[number];
export const SECTIONS = [
  ['traits', 'Traits'],
  ['actions', 'Actions'],
  ['bonus', 'Bonus Actions'],
  ['reactions', 'Reactions'],
  ['legendary', 'Legendary Actions']
] as const;
export type Section = (typeof SECTIONS)[number][0];

export type StatBlock = {
  size?: string;
  type?: string;
  alignment?: string;
  /** "17 (chain shirt, shield)" */
  ac?: string;
  /** "21 (6d6)" */
  hp?: string;
  speed?: string;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  saves?: string;
  skills?: string;
  vulnerabilities?: string;
  resistances?: string;
  immunities?: string;
  conditionImmunities?: string;
  senses?: string;
  languages?: string;
  cr?: string;
  traits?: Feature[];
  actions?: Feature[];
  bonus?: Feature[];
  reactions?: Feature[];
  legendary?: Feature[];
  /** Its book ("XMM"), or "Homebrew". */
  source?: string;
};

const TEXT_FIELDS = ['size', 'type', 'alignment', 'ac', 'hp', 'speed', 'saves', 'skills', 'vulnerabilities', 'resistances', 'immunities', 'conditionImmunities', 'senses', 'languages', 'cr', 'source'] as const;

/** The modifier for a score: 15 is +2. */
export const modifier = (score: number | undefined) => Math.floor(((score ?? 10) - 10) / 2);
export const signedMod = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);
/** The first whole number in a text ("17 (natural armor)" is 17), or null. */
export const leadingNumber = (s: string | undefined) => {
  const m = /-?\d+/.exec(s ?? '');
  return m ? Number(m[0]) : null;
};
/** What it adds to initiative: its Dexterity modifier. */
export const initiativeBonus = (sb: StatBlock | null | undefined) => modifier(sb?.dex);

/**
 * Kept to what the database takes: known fields only, texts trimmed and
 * capped, scores whole numbers from 1 to 30, at most 30 features a section.
 */
export function cleanStatBlock(input: unknown): StatBlock {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: StatBlock = {};
  for (const k of TEXT_FIELDS) {
    const v = typeof raw[k] === 'string' ? (raw[k] as string).trim().slice(0, 400) : '';
    if (v) out[k] = v;
  }
  for (const a of ABILITIES) {
    const n = Number(raw[a]);
    if (raw[a] !== undefined && raw[a] !== '' && Number.isFinite(n)) out[a] = Math.min(30, Math.max(1, Math.round(n)));
  }
  for (const [k] of SECTIONS) {
    const list = Array.isArray(raw[k]) ? (raw[k] as unknown[]) : [];
    const kept = list
      .map((f) => (f && typeof f === 'object' ? (f as Record<string, unknown>) : {}))
      .map((f) => ({ name: String(f.name ?? '').trim().slice(0, 120), text: String(f.text ?? '').trim().slice(0, 3000) }))
      .filter((f) => f.name || f.text)
      .slice(0, 30);
    if (kept.length) out[k] = kept;
  }
  return out;
}

export const isEmpty = (sb: StatBlock | null | undefined) => !sb || Object.keys(sb).length === 0;

// ── From 5e.tools' data ─────────────────────────────────────────────────

/** HTML made by `inline`, back to plain words. */
export function plain(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
const words = (s: unknown) => plain(inline(String(s ?? '')));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const SIZE: Record<string, string> = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
const ALIGN: Record<string, string> = { L: 'Lawful', N: 'Neutral', C: 'Chaotic', G: 'Good', E: 'Evil', U: 'Unaligned', A: 'Any alignment', NX: 'Neutral', NY: 'Neutral' };
const ABILITY_NAME: Record<string, string> = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' };

/** Entries (strings, lists, nested entries) as plain lines. */
function textOf(entries: unknown): string {
  if (entries == null) return '';
  if (typeof entries === 'string') return words(entries);
  if (Array.isArray(entries)) return entries.map(textOf).filter(Boolean).join('\n');
  const e = entries as Raw;
  if (e.type === 'list') return (e.items ?? []).map((i: unknown) => `• ${textOf(typeof i === 'object' && (i as Raw).entries ? [(i as Raw).name ? `${(i as Raw).name}. ` : '', ...(i as Raw).entries] : i)}`).join('\n');
  if (e.type === 'item') return `${e.name ? `${words(e.name)} ` : ''}${textOf(e.entry ?? e.entries)}`;
  if (e.entries) return `${e.name ? `${words(e.name)}. ` : ''}${textOf(e.entries)}`;
  if (e.entry) return textOf(e.entry);
  return '';
}

function typeLine(t: unknown): string {
  if (!t) return '';
  if (typeof t === 'string') return cap(t);
  const r = t as Raw;
  const base = typeof r.type === 'string' ? r.type : (r.type?.choose ?? []).join(' or ');
  const tags = (r.tags ?? []).map((x: unknown) => (typeof x === 'string' ? x : (x as Raw).tag)).filter(Boolean);
  return cap(base) + (tags.length ? ` (${tags.map((x: string) => cap(x)).join(', ')})` : '');
}

function alignment(list: unknown): string {
  if (!Array.isArray(list)) return '';
  if (list.every((x) => typeof x === 'string')) {
    const codes = list as string[];
    if (codes.length === 1) return ALIGN[codes[0]] ?? codes[0];
    if (codes.join('') === 'NXCGNYE') return 'Any non-lawful alignment';
    return codes.map((c) => ALIGN[c] ?? c).join(' ');
  }
  const first = list.find((x) => typeof x === 'object') as Raw | undefined;
  return first?.special ?? (first?.alignment ? alignment(first.alignment) : '');
}

function acLine(ac: unknown): string {
  if (!Array.isArray(ac)) return '';
  return ac
    .map((a) => (typeof a === 'number' ? String(a) : a?.special ? words(a.special) : `${a.ac}${a.from ? ` (${a.from.map(words).join(', ')})` : ''}${a.condition ? ` ${words(a.condition)}` : ''}`))
    .join(', ');
}

function speedLine(sp: unknown): string {
  if (typeof sp === 'number') return `${sp} ft.`;
  if (!sp || typeof sp !== 'object') return '';
  const s = sp as Raw;
  const part = (k: string, v: unknown) => {
    const n = typeof v === 'number' ? v : (v as Raw)?.number;
    const cond = typeof v === 'object' && (v as Raw)?.condition ? ` ${words((v as Raw).condition)}` : '';
    if (n == null) return '';
    return `${k === 'walk' ? '' : `${k} `}${n} ft.${cond}${k === 'fly' && s.canHover ? ' (hover)' : ''}`;
  };
  return ['walk', 'burrow', 'climb', 'fly', 'swim'].map((k) => (k in s ? part(k, s[k]) : '')).filter(Boolean).join(', ');
}

function damageList(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return list
    .map((x) => {
      if (typeof x === 'string') return cap(x);
      const r = x as Raw;
      if (r.special) return words(r.special);
      const inner = r.resist ?? r.immune ?? r.vulnerable ?? r.conditionImmune ?? [];
      return `${r.preNote ? `${words(r.preNote)} ` : ''}${damageList(inner)}${r.note ? ` ${words(r.note)}` : ''}`;
    })
    .filter(Boolean)
    .join(', ');
}

const listLine = (o: unknown) =>
  o && typeof o === 'object' && !Array.isArray(o)
    ? Object.entries(o as Raw).filter(([k]) => k !== 'other').map(([k, v]) => `${ABILITY_NAME[k] ?? cap(k)} ${v}`).join(', ')
    : '';

function features(list: unknown): Feature[] {
  if (!Array.isArray(list)) return [];
  return list.map((f: Raw) => ({ name: words(f.name ?? ''), text: textOf(f.entries ?? f.entry ?? '') })).filter((f) => f.name || f.text);
}

/** A monster's spellcasting, as a feature: its header, then each list of spells. */
function spellcasting(sc: Raw): Feature {
  const lines = [textOf(sc.headerEntries ?? [])];
  const spells = (l: unknown) => (Array.isArray(l) ? l.map((x) => words(typeof x === 'string' ? x : (x as Raw).entry ?? '')).join(', ') : '');
  if (sc.will?.length) lines.push(`At will: ${spells(sc.will)}`);
  for (const [k, v] of Object.entries(sc.daily ?? {})) lines.push(`${k.replace('e', '')}/day${k.endsWith('e') ? ' each' : ''}: ${spells(v)}`);
  for (const [lvl, v] of Object.entries(sc.spells ?? {})) {
    const r = v as Raw;
    lines.push(`${lvl === '0' ? 'Cantrips' : `Level ${lvl}${r.slots ? ` (${r.slots} slots)` : ''}`}: ${spells(r.spells)}`);
  }
  if (sc.footerEntries) lines.push(textOf(sc.footerEntries));
  return { name: words(sc.name ?? 'Spellcasting'), text: lines.filter(Boolean).join('\n') };
}

/** Where 5e.tools keeps its pictures (token art and the like), served with CORS so Owlbear can draw them too. */
export const FIVE_IMG = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-img/main';
/**
 * A 5e.tools monster's token art (the round portrait its pages and maps use),
 * or '' when it has none. Named as 5e.tools names the files: the monster's
 * name in plain letters, under its book (or the book a token borrows from).
 */
export function monsterArt(m: Raw): string {
  const plain = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/"/g, '');
  const at = (source: string, name: string) => `${FIVE_IMG}/bestiary/tokens/${encodeURIComponent(source)}/${encodeURIComponent(plain(name))}.webp`;
  const token = m.token as { name?: unknown; source?: unknown } | undefined;
  if (token && typeof token.name === 'string' && typeof token.source === 'string') return at(token.source, token.name);
  if (typeof m.tokenHref === 'object' && m.tokenHref && typeof (m.tokenHref as { url?: unknown }).url === 'string') return (m.tokenHref as { url: string }).url;
  if (m.hasToken === true && typeof m.name === 'string' && typeof m.source === 'string') return at(m.source, m.name);
  return '';
}

/** A 5e.tools monster as a stat block. */
export function fromFiveTools(m: Raw): StatBlock {
  const sb: StatBlock = {
    size: (m.size ?? []).map((s: string) => SIZE[s] ?? s).join(' or '),
    type: typeLine(m.type),
    alignment: alignment(m.alignment),
    ac: acLine(m.ac),
    hp: m.hp?.special ? words(m.hp.special) : m.hp ? `${m.hp.average ?? ''}${m.hp.formula ? ` (${m.hp.formula})` : ''}`.trim() : '',
    speed: speedLine(m.speed),
    saves: listLine(m.save),
    skills: listLine(m.skill),
    vulnerabilities: damageList(m.vulnerable),
    resistances: damageList(m.resist),
    immunities: damageList(m.immune),
    conditionImmunities: damageList(m.conditionImmune),
    senses: [...(m.senses ?? []).map(words), m.passive != null ? `Passive Perception ${m.passive}` : ''].filter(Boolean).join(', '),
    languages: (m.languages ?? []).map(words).join(', '),
    cr: m.cr == null ? '' : typeof m.cr === 'string' ? m.cr : (m.cr.cr ?? ''),
    traits: features(m.trait),
    actions: features(m.action),
    bonus: features(m.bonus),
    reactions: features(m.reaction),
    legendary: features(m.legendary),
    source: m.source ?? ''
  };
  for (const a of ABILITIES) if (typeof m[a] === 'number') sb[a] = m[a];
  for (const sc of m.spellcasting ?? []) {
    const f = spellcasting(sc);
    const where: Section = sc.displayAs === 'action' ? 'actions' : sc.displayAs === 'bonus' ? 'bonus' : sc.displayAs === 'reaction' ? 'reactions' : 'traits';
    sb[where] = [...(sb[where] ?? []), f];
  }
  return cleanStatBlock(sb);
}

// ── As HTML ─────────────────────────────────────────────────────────────

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const para = (s: string) => esc(s).replace(/\n/g, '<br>');

/** "Small Fey (Goblinoid), Chaotic Neutral" */
export const kindLine = (sb: StatBlock) => [[sb.size, sb.type].filter(Boolean).join(' '), sb.alignment].filter(Boolean).join(', ');

/** The stat block as HTML (every text escaped), in the classes app.css styles (`.sb-…`). */
export function statBlockHtml(sb: StatBlock): string {
  const top = [['Armor Class', sb.ac], ['Hit Points', sb.hp], ['Speed', sb.speed]].filter(([, v]) => v);
  const scores = ABILITIES.some((a) => sb[a] !== undefined)
    ? `<div class="sb-abilities">${ABILITIES.map((a) => `<div><span>${a.toUpperCase()}</span><b>${sb[a] ?? 10}</b><i>${signedMod(modifier(sb[a]))}</i></div>`).join('')}</div>`
    : '';
  const lines = [
    ['Saving Throws', sb.saves], ['Skills', sb.skills], ['Vulnerabilities', sb.vulnerabilities], ['Resistances', sb.resistances],
    ['Immunities', sb.immunities], ['Condition Immunities', sb.conditionImmunities], ['Senses', sb.senses], ['Languages', sb.languages],
    ['Challenge', sb.cr]
  ].filter(([, v]) => v);
  const dl = (rows: (string | undefined)[][]) =>
    rows.length ? `<dl class="sb-lines">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${para(v ?? '')}</dd></div>`).join('')}</dl>` : '';
  const sections = SECTIONS.map(([k, title]) => {
    const list = sb[k] ?? [];
    if (!list.length) return '';
    return `<h4 class="sb-section">${esc(title)}</h4>${list.map((f) => `<p class="sb-feature">${f.name ? `<b>${esc(f.name)}.</b> ` : ''}${para(f.text)}</p>`).join('')}`;
  }).join('');
  return `<div class="sb">${dl(top)}${scores}${dl(lines)}${sections}</div>`;
}
