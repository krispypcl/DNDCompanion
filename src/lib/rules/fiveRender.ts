/**
 * An entry from 5e.tools' data, made readable: its name, a line saying what
 * it is, its facts (casting time, cost…), its text and its book. The text is
 * built as HTML from the data's own structure with every piece of text
 * escaped, so it is safe to place in the page.
 */
import type { Found, ItemWords, Raw } from './fiveData';
import { fromFiveTools, kindLine, statBlockHtml } from './statblock';

/** Every string here is HTML, built with its text escaped. */
export type Rendered = {
  name: string;
  /** "Level 3 Evocation", "Light Armor", "Origin Feat". */
  kind: string;
  facts: [string, string][];
  html: string;
  /** "Player's Handbook (2024), page 241". */
  source: string;
};

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Inline tags: {@spell fireball|xphb}, {@damage 8d6}, {@b bold} ─────────

const ABILITY: Record<string, string> = {
  str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma'
};
const ATTACK: Record<string, string> = {
  m: 'Melee Attack Roll:', r: 'Ranged Attack Roll:', 'm,r': 'Melee or Ranged Attack Roll:',
  mw: 'Melee Weapon Attack:', rw: 'Ranged Weapon Attack:', 'mw,rw': 'Melee or Ranged Weapon Attack:',
  ms: 'Melee Spell Attack:', rs: 'Ranged Spell Attack:'
};
/** Which part of a tag is the words shown, where it is not the third. */
// {@classFeature name|class|classSource|level|source|shown},
// {@subclassFeature name|class|classSource|subclass|subclassSource|level|source|shown}.
const SHOWN_AT: Record<string, number> = { classFeature: 5, subclassFeature: 7, quickref: 4, filter: 0, link: 0, '5etools': 0, area: 0 };

function tag(name: string, body: string): string {
  const parts = body.split('|');
  const first = parts[0];
  switch (name) {
    case 'b':
    case 'bold':
      return `<b>${inline(body)}</b>`;
    case 'i':
    case 'italic':
      return `<i>${inline(body)}</i>`;
    case 'u':
    case 'underline':
      return `<u>${inline(body)}</u>`;
    case 's':
    case 'strike':
      return `<s>${inline(body)}</s>`;
    case 'note':
      return `<span class="five-note">${inline(body)}</span>`;
    case 'hit':
      return esc(/^[+-]/.test(first) ? first : `+${first}`);
    case 'd20':
      return esc(/^[+-]/.test(first) ? first : `+${first}`);
    case 'dc':
      return `DC ${esc(first)}`;
    case 'chance':
      return esc(parts[1] || `${first} percent`);
    case 'recharge':
      return esc(`(Recharge ${first ? `${first}–6` : '6'})`);
    case 'scaledamage':
    case 'scaledice':
      return esc(parts[2] || first);
    case 'atk':
    case 'atkr':
      return `<i>${esc(ATTACK[first] ?? 'Attack:')}</i>`;
    case 'h':
      return '<i>Hit:</i> ';
    case 'm':
      return '<i>Miss:</i> ';
    case 'hom':
      return '<i>Hit or Miss:</i> ';
    case 'actSave':
      return `<i>${esc(ABILITY[first] ?? cap(first))} Saving Throw:</i>`;
    case 'actSaveFail':
      return `<i>${first ? `Failure by ${esc(first)} or More:` : 'Failure:'}</i>`;
    case 'actSaveSuccess':
      return '<i>Success:</i>';
    case 'actSaveSuccessOrFail':
      return '<i>Failure or Success:</i>';
    case 'actTrigger':
      return '<i>Trigger:</i>';
    case 'actResponse':
      return '<i>Response:</i>';
    case 'skillCheck':
      return esc(cap(first.replace(/_/g, ' ')));
    default: {
      const at = SHOWN_AT[name] ?? 2;
      const shown = parts[at] || first;
      return esc(shown);
    }
  }
}

/** A line of text with its tags turned into words. */
export function inline(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('{@', i);
    if (open < 0) {
      out += esc(text.slice(i));
      break;
    }
    out += esc(text.slice(i, open));
    // The tag runs to its own closing brace; tags may hold tags.
    let depth = 0;
    let j = open;
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}' && --depth === 0) break;
    }
    const inner = text.slice(open + 2, j);
    const space = inner.search(/\s/);
    const name = space < 0 ? inner : inner.slice(0, space);
    const body = space < 0 ? '' : inner.slice(space + 1);
    out += tag(name, body);
    i = j + 1;
  }
  return out;
}

// ── Blocks ───────────────────────────────────────────────────────────────

function cell(c: unknown): string {
  if (c && typeof c === 'object') {
    const o = c as Raw;
    if (o.roll) return esc(o.roll.exact ?? `${o.roll.min}–${o.roll.max}`);
    if (o.entry) return block(o.entry, 9, true);
    if (o.entries) return blocks(o.entries, 9);
  }
  return inline(String(c ?? ''));
}

function block(e: unknown, depth = 0, bare = false): string {
  if (e == null) return '';
  if (typeof e === 'string') return bare ? inline(e) : `<p>${inline(e)}</p>`;
  if (typeof e !== 'object') return bare ? esc(e) : `<p>${esc(e)}</p>`;
  const o = e as Raw;
  const head = (name: unknown) => (name ? `<h${depth < 1 ? 4 : 5}>${inline(String(name))}</h${depth < 1 ? 4 : 5}>` : '');
  switch (o.type) {
    case 'list':
      return `<ul>${(o.items ?? []).map((it: unknown) => `<li>${block(it, depth + 1, true)}</li>`).join('')}</ul>`;
    case 'item':
    case 'itemSub':
    case 'itemSpell': {
      const text = o.entry !== undefined ? block(o.entry, depth + 1, true) : (o.entries ?? []).map((x: unknown) => block(x, depth + 1, true)).join(' ');
      return `${o.name ? `<b>${inline(String(o.name).replace(/[.:]?$/, ''))}.</b> ` : ''}${text}`;
    }
    case 'table': {
      const labels = (o.colLabels ?? []).map((l: string) => `<th>${inline(l)}</th>`).join('');
      const rows = (o.rows ?? []).map((r: unknown[]) => `<tr>${(Array.isArray(r) ? r : (r as Raw).row ?? []).map((c: unknown) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('');
      return `<div class="five-table">${o.caption ? `<p class="five-cap">${inline(o.caption)}</p>` : ''}<table>${labels ? `<thead><tr>${labels}</tr></thead>` : ''}<tbody>${rows}</tbody></table></div>`;
    }
    case 'quote':
      return `<blockquote>${blocks(o.entries, depth + 1)}${o.by ? `<p class="five-by">${inline(o.by)}</p>` : ''}</blockquote>`;
    case 'inset':
    case 'insetReadaloud':
      return `<div class="five-inset">${head(o.name)}${blocks(o.entries, depth + 1)}</div>`;
    case 'abilityDc':
      return `<p class="five-centre"><b>${inline(o.name ?? 'Spell')} save DC</b> = 8 + your Proficiency Bonus + your ${(o.attributes ?? []).map((a: string) => ABILITY[a] ?? a).join(' or ')} modifier</p>`;
    case 'abilityAttackMod':
      return `<p class="five-centre"><b>${inline(o.name ?? 'Spell')} attack modifier</b> = your Proficiency Bonus + your ${(o.attributes ?? []).map((a: string) => ABILITY[a] ?? a).join(' or ')} modifier</p>`;
    case 'refClassFeature':
    case 'refSubclassFeature':
    case 'refOptionalfeature': {
      const ref = String(o.classFeature ?? o.subclassFeature ?? o.optionalfeature ?? '').split('|')[0];
      return ref ? `<p class="five-ref">${esc(ref)}</p>` : '';
    }
    case 'hr':
      return '<hr />';
    case 'image':
    case 'gallery':
      return '';
    case 'inline':
    case 'inlineBlock':
      return bare ? (o.entries ?? []).map((x: unknown) => block(x, depth, true)).join('') : `<p>${(o.entries ?? []).map((x: unknown) => block(x, depth, true)).join('')}</p>`;
    case 'link':
      return esc(o.text ?? '');
    default:
      if (o.entries) {
        // A named block reads as a heading; a run-in name (as 5e.tools sets
        // the first paragraph of a sub-entry) as bold words.
        if (o.name && depth >= 1 && typeof o.entries[0] === 'string') {
          const [first, ...rest] = o.entries;
          return `<p><b><i>${inline(String(o.name))}.</i></b> ${inline(first)}</p>${blocks(rest, depth + 1)}`;
        }
        return `${head(o.name)}${blocks(o.entries, depth + 1)}`;
      }
      if (o.entry !== undefined) return block(o.entry, depth, bare);
      return '';
  }
}

const blocks = (list: unknown, depth = 0) => (Array.isArray(list) ? list.map((e) => block(e, depth)).join('') : block(list, depth));

// ── What each kind of entry says above its text ──────────────────────────

const SCHOOL: Record<string, string> = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation', P: 'Psionic'
};
const UNIT: Record<string, string> = { action: 'Action', bonus: 'Bonus Action', reaction: 'Reaction', minute: 'minute', hour: 'hour', round: 'round' };

function spellTime(times: Raw[] = []): string {
  return times
    .map((t) => {
      const unit = t.unit === 'bonus' || t.unit === 'action' || t.unit === 'reaction' ? UNIT[t.unit] : `${UNIT[t.unit] ?? t.unit}${t.number === 1 ? '' : 's'}`;
      return `${t.number === 1 && /Action|Reaction/.test(unit) ? '' : `${t.number} `}${unit}${t.condition ? `, ${t.condition}` : ''}`;
    })
    .join(' or ');
}

function distance(d: Raw | undefined): string {
  if (!d) return '';
  if (['self', 'touch', 'sight', 'unlimited'].includes(d.type)) return cap(d.type);
  const unit = d.type === 'feet' ? (d.amount === 1 ? 'foot' : 'feet') : d.type === 'miles' ? (d.amount === 1 ? 'mile' : 'miles') : d.type;
  return `${d.amount} ${unit}`;
}

function spellRange(r: Raw | undefined): string {
  if (!r) return '';
  if (r.type === 'point') return distance(r.distance);
  if (r.type === 'special') return 'Special';
  // An area from the caster: "Self (15-foot Cone)".
  const size = r.distance ? `${r.distance.amount}-${r.distance.type === 'feet' ? 'foot' : r.distance.type.replace(/s$/, '')}` : '';
  return `Self${size ? ` (${size} ${cap(r.type === 'radius' ? 'Emanation' : r.type)})` : ''}`;
}

function components(c: Raw | undefined): string {
  if (!c) return '';
  const out = [c.v && 'V', c.s && 'S', c.m && `M (${typeof c.m === 'string' ? c.m : c.m.text})`].filter(Boolean);
  return out.join(', ');
}

function duration(list: Raw[] = []): string {
  return list
    .map((d) => {
      if (d.type === 'instant') return 'Instantaneous';
      if (d.type === 'permanent') return d.ends?.includes('dispel') ? 'Until dispelled' : 'Permanent';
      if (d.type === 'special') return 'Special';
      if (d.type === 'timed') {
        const amount = d.duration?.amount ?? 1;
        const t = `${amount} ${d.duration?.type}${amount === 1 ? '' : 's'}`;
        return d.concentration ? `Concentration, up to ${t}` : t;
      }
      return cap(String(d.type));
    })
    .join(' or ');
}

const ITEM_TYPE: Record<string, string> = {
  LA: 'Light Armor', MA: 'Medium Armor', HA: 'Heavy Armor', S: 'Shield', M: 'Melee Weapon', R: 'Ranged Weapon', A: 'Ammunition',
  AF: 'Ammunition', G: 'Adventuring Gear', AT: "Artisan's Tools", T: 'Tools', GS: 'Gaming Set', INS: 'Musical Instrument',
  SCF: 'Spellcasting Focus', P: 'Potion', RG: 'Ring', RD: 'Rod', WD: 'Wand', ST: 'Staff', SC: 'Scroll', MNT: 'Mount',
  VEH: 'Vehicle', SHP: 'Vessel', TAH: 'Tack and Harness', FD: 'Food and Drink', TG: 'Trade Good', $: 'Treasure',
  $A: 'Art Object', $G: 'Gemstone', $C: 'Coinage', OTH: 'Other', EXP: 'Explosive', IDG: 'Illegal Drug'
};
const DAMAGE: Record<string, string> = {
  A: 'Acid', B: 'Bludgeoning', C: 'Cold', F: 'Fire', O: 'Force', L: 'Lightning', N: 'Necrotic', P: 'Piercing', I: 'Poison',
  Y: 'Psychic', R: 'Radiant', S: 'Slashing', T: 'Thunder'
};
const PROPERTY: Record<string, string> = {
  V: 'Versatile', F: 'Finesse', L: 'Light', H: 'Heavy', T: 'Thrown', '2H': 'Two-Handed', R: 'Reach', A: 'Ammunition',
  LD: 'Loading', S: 'Special', RLD: 'Reload', BF: 'Burst Fire', AF: 'Ammunition (Firearm)'
};
const code = (s: unknown) => String(s ?? '').split('|')[0];

function coins(cp: number): string {
  if (cp % 100 === 0) return `${(cp / 100).toLocaleString('en')} GP`;
  if (cp % 10 === 0) return `${cp / 10} SP`;
  return `${cp} CP`;
}

function itemFacts(e: Raw, words: ItemWords = { types: {}, props: {} }): { kind: string; facts: [string, string][] } {
  const t = ITEM_TYPE[code(e.type)] ?? words.types[code(e.type).toUpperCase()];
  const rarity = e.rarity && !['none', 'unknown', 'unknown (magic)'].includes(e.rarity) ? cap(e.rarity) : '';
  const base = t ?? (e.wondrous ? 'Wondrous Item' : e.weapon ? 'Weapon' : e.armor ? 'Armor' : 'Item');
  const kind = [e.weaponCategory ? `${cap(e.weaponCategory)} ${base}` : base, rarity, e.reqAttune ? `(Requires Attunement${typeof e.reqAttune === 'string' ? ` ${e.reqAttune}` : ''})` : '']
    .filter(Boolean)
    .join(', ')
    .replace(', (', ' (');
  const facts: [string, string][] = [];
  if (e.ac !== undefined) {
    const dex = code(e.type) === 'LA' ? ' + Dex modifier' : code(e.type) === 'MA' ? ' + Dex modifier (max 2)' : '';
    facts.push(['Armor Class', code(e.type) === 'S' ? `+${e.ac}` : `${e.ac}${dex}`]);
  }
  if (e.strength) facts.push(['Strength', String(e.strength)]);
  if (e.stealth) facts.push(['Stealth', 'Disadvantage']);
  if (e.dmg1) facts.push(['Damage', `${e.dmg1} ${DAMAGE[e.dmgType] ?? ''}`.trim()]);
  const props = (e.property ?? []).map((p: unknown) => {
    const k = code(typeof p === 'object' ? (p as Raw).uid : p);
    const name = PROPERTY[k] ?? words.props[k.toUpperCase()] ?? k;
    if (k === 'V' && e.dmg2) return `${name} (${e.dmg2})`;
    if ((k === 'T' || k === 'A' || k === 'AF') && e.range) return `${name} (Range ${e.range})`;
    if (/^RLD$|-Re$/i.test(k) && e.reload) return `${name} (${e.reload})`;
    return name;
  });
  if (props.length) facts.push(['Properties', props.join(', ')]);
  if (e.mastery?.length) facts.push(['Mastery', e.mastery.map((m: unknown) => code(typeof m === 'object' ? (m as Raw).uid : m)).join(', ')]);
  if (e.weight) facts.push(['Weight', `${e.weight} lb.`]);
  if (e.value) facts.push(['Cost', coins(e.value)]);
  return { kind, facts };
}

const FEAT_CATEGORY: Record<string, string> = { O: 'Origin Feat', G: 'General Feat', FS: 'Fighting Style Feat', 'FS:P': 'Fighting Style Feat', 'FS:R': 'Fighting Style Feat', EB: 'Epic Boon Feat' };

function prerequisite(list: Raw[] | undefined): string {
  if (!list?.length) return '';
  return list
    .map((p) =>
      [
        p.level && (typeof p.level === 'number' ? `Level ${p.level}+` : `${p.level.class?.name ?? ''} Level ${p.level.level}+`.trim()),
        ...(p.ability ?? []).map((a: Raw) => Object.entries(a).map(([k, v]) => `${ABILITY[k] ?? k} ${v}+`).join(' or ')),
        p.spellcasting2020 || p.spellcasting ? 'Spellcasting or Pact Magic Feature' : '',
        ...(p.proficiency ?? []).map((pr: Raw) => Object.entries(pr).map(([k, v]) => `${cap(String(v))} ${k} proficiency`).join(', ')),
        ...(p.feat ?? []).map((f: string) => `${cap(code(f))} Feat`),
        ...(p.race ?? []).map((r: Raw) => cap(r.name)),
        p.other
      ]
        .filter(Boolean)
        .join(', ')
    )
    .filter(Boolean)
    .join('; or ');
}

const SIZE: Record<string, string> = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };

const BOOKS: Record<string, string> = {
  XPHB: "Player's Handbook (2024)", PHB: "Player's Handbook (2014)", XDMG: "Dungeon Master's Guide (2024)",
  DMG: "Dungeon Master's Guide (2014)", XMM: 'Monster Manual (2025)', MM: 'Monster Manual (2014)',
  XGE: "Xanathar's Guide to Everything", TCE: "Tasha's Cauldron of Everything", MPMM: 'Mordenkainen Presents: Monsters of the Multiverse',
  SCAG: "Sword Coast Adventurer's Guide", FTD: "Fizban's Treasury of Dragons", VGM: "Volo's Guide to Monsters",
  MTF: "Mordenkainen's Tome of Foes", EGW: "Explorer's Guide to Wildemount", BMT: 'The Book of Many Things',
  SatO: 'Sigil and the Outlands', AAG: "Astral Adventurer's Guide", GGR: "Guildmasters' Guide to Ravnica",
  VRGR: "Van Richten's Guide to Ravenloft", EFA: 'Eberron: Forge of the Artificer', FRHoF: 'Forgotten Realms: Heroes of Faerûn'
};

function sourceLine(e: Raw): string {
  const book = BOOKS[e.source] ?? e.source ?? '';
  return [book, e.page ? `page ${e.page}` : ''].filter(Boolean).join(', ');
}

/** A class's features, level by level, each with its text. */
function featureList(list: Raw[]): string {
  return list
    .filter((f) => f.type !== 'inset')
    // A feature's pointers to the others are left out: they follow it anyway.
    .map((f) => `<h4>${inline(f.name)}<span class="five-level"> · Level ${f.level}</span></h4>${blocks((f.entries ?? []).filter((x: Raw) => !String(x?.type ?? '').startsWith('ref')), 1)}`)
    .join('');
}

export function render(found: Found): Rendered {
  const e = found.entry;
  let kind = '';
  let facts: [string, string][] = [];
  let html = '';
  switch (found.kind) {
    case 'spell': {
      const school = SCHOOL[e.school] ?? e.school ?? '';
      kind = e.level === 0 ? `${school} Cantrip` : `Level ${e.level} ${school}`;
      facts = [
        ['Casting Time', spellTime(e.time)],
        ['Range', spellRange(e.range)],
        ['Components', components(e.components)],
        ['Duration', duration(e.duration)]
      ];
      html = blocks(e.entries) + blocks(e.entriesHigherLevel);
      break;
    }
    case 'item': {
      ({ kind, facts } = itemFacts(e, found.words));
      html = blocks(e.entries);
      break;
    }
    case 'feat':
      kind = FEAT_CATEGORY[e.category] ?? 'Feat';
      if (prerequisite(e.prerequisite)) facts = [['Prerequisite', prerequisite(e.prerequisite)]];
      html = blocks(e.entries);
      break;
    case 'optionalfeature':
      kind = 'Option';
      if (prerequisite(e.prerequisite)) facts = [['Prerequisite', prerequisite(e.prerequisite)]];
      html = blocks(e.entries);
      break;
    case 'race': {
      kind = 'Species';
      const sizes = (e.size ?? []).map((s: string) => SIZE[s] ?? s);
      const speed = typeof e.speed === 'number' ? `${e.speed} feet` : e.speed?.walk ? `${e.speed.walk} feet` : '';
      facts = [
        ['Creature Type', (e.creatureTypes ?? ['humanoid']).map(cap).join(', ')],
        ['Size', sizes.join(' or ')],
        ['Speed', speed]
      ];
      html = blocks(e.entries);
      break;
    }
    case 'background':
      kind = 'Background';
      html = blocks(e.entries);
      break;
    case 'condition':
      kind = 'Condition';
      html = blocks(e.entries);
      break;
    case 'classFeature':
      kind = `${e.subclassShortName ? `${e.subclassShortName} ` : ''}${e.className} Feature, Level ${e.level}`;
      html = blocks(e.entries);
      break;
    case 'subclass': {
      kind = `${e.className} Subclass`;
      html = featureList(found.features);
      break;
    }
    case 'monster': {
      // Through the app's own stat block, so a monster looks the same in a
      // pop-up as on the DM's table.
      const sb = fromFiveTools(e);
      kind = kindLine(sb);
      return { name: esc(e.name), kind: esc(kind), facts: [], html: statBlockHtml(sb), source: esc(sourceLine(e)) };
    }
    case 'class': {
      kind = 'Class';
      const hd = e.hd ? `D${e.hd.faces}` : '';
      const primary = (e.primaryAbility ?? []).map((o: Raw) => Object.keys(o).map((k) => ABILITY[k] ?? k).join(' and ')).join(' or ');
      const saves = (e.proficiency ?? []).map((k: string) => ABILITY[k] ?? k).join(' and ');
      facts = [
        ['Primary Ability', primary],
        ['Hit Point Die', hd ? `${hd} per ${e.name} level` : ''],
        ['Saving Throws', saves]
      ];
      html = featureList(found.features.filter((f) => !f.isClassFeatureVariant));
      break;
    }
  }
  return {
    name: esc(e.name),
    kind: inline(kind),
    facts: facts.filter(([, v]) => v).map(([k, v]) => [esc(k), inline(v)]),
    html,
    source: esc(sourceLine(e))
  };
}
