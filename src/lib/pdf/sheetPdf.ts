/**
 * The character sheet as a PDF form: the four pages of the D&D Beyond sheet
 * (character, features and equipment, details, spells) in the same order,
 * with the same boxes where a player expects them, drawn in DND Companion's
 * own light style and branded with its die and name. Every value is a form
 * field, so it can be edited in any PDF reader before printing. Anything too
 * long for its box carries on onto a page of its own rather than being cut.
 *
 * Coordinates are written from the top-left of a US Letter page (612 × 792
 * points), the way the page is read, and turned over for pdf-lib here.
 */
import fontkit from '@cantoo/fontkit';
import {
  PDFDocument,
  PDFFont,
  PDFHexString,
  PDFName,
  PDFString,
  PDFPage,
  PDFTextField,
  TextAlignment,
  drawEllipse,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type RGB
} from '@cantoo/pdf-lib';
import type { Definition, State } from '#lib/types.ts';
import { sheetContent, type Paragraph, type SheetContent } from './content';

const W = 612;
const H = 792;

type Fonts = { regular: PDFFont; semibold: PDFFont; bold: PDFFont; italic: PDFFont; brand: PDFFont };

const hexRgb = (hex: string): RGB => {
  const h = hex.replace('#', '');
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
};
// Grayscale throughout, and every word black: values and labels alike.
const INK = rgb(0, 0, 0);
const VALUE = rgb(0, 0, 0);
const MUTED = rgb(0, 0, 0);
const SOFT = hexRgb('#c9c9d0');
const WELL = hexRgb('#f2f2f5');
const BAND = hexRgb('#f6f6f8');
const WHITE = rgb(1, 1, 1);

/** Everything a page is drawn with. */
type Kit = {
  doc: PDFDocument;
  fonts: Fonts;
  accent: RGB;
  wash: RGB;
  content: SheetContent;
  /** Field names already used: the same name on another page is the same field, so it stays in step. */
  fields: Map<string, PDFTextField>;
  pages: PDFPage[];
};

// ── Drawing ──────────────────────────────────────────────────────────────

const roundRect = (w: number, h: number, r: number) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M ${rr} 0 H ${w - rr} A ${rr} ${rr} 0 0 1 ${w} ${rr} V ${h - rr} A ${rr} ${rr} 0 0 1 ${w - rr} ${h} H ${rr} A ${rr} ${rr} 0 0 1 0 ${h - rr} V ${rr} A ${rr} ${rr} 0 0 1 ${rr} 0 Z`;
};

function box(page: PDFPage, x: number, y: number, w: number, h: number, o: { r?: number; stroke?: RGB; fill?: RGB; width?: number } = {}) {
  page.drawSvgPath(roundRect(w, h, o.r ?? 6), {
    x, y: H - y,
    borderColor: o.stroke, borderWidth: o.stroke ? (o.width ?? 0.9) : 0,
    color: o.fill
  });
}

function circle(page: PDFPage, cx: number, cy: number, r: number, o: { stroke?: RGB; fill?: RGB; width?: number } = {}) {
  page.drawCircle({ x: cx, y: H - cy, size: r, borderColor: o.stroke, borderWidth: o.stroke ? (o.width ?? 0.8) : 0, color: o.fill });
}

function line(page: PDFPage, x1: number, y1: number, x2: number, y2: number, color = SOFT, width = 0.6) {
  page.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, color, thickness: width });
}

/** Text with its top at y. `spacing` spreads capitals the way small labels are set. */
function write(page: PDFPage, s: string, x: number, y: number, o: { font: PDFFont; size: number; color?: RGB; align?: 'left' | 'center' | 'right'; spacing?: number; maxWidth?: number }) {
  const spacing = o.spacing ?? 0;
  let size = o.size;
  const width = (sz: number) => o.font.widthOfTextAtSize(s, sz) + spacing * Math.max(0, s.length - 1);
  // Never cut short: a label too long for its room is set a little smaller instead.
  while (o.maxWidth && width(size) > o.maxWidth && size > 4) size -= 0.25;
  const total = width(size);
  let at = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  const baseline = H - y - o.font.heightAtSize(size, { descender: false });
  if (!spacing) {
    page.drawText(s, { x: at, y: baseline, size, font: o.font, color: o.color ?? INK });
    return;
  }
  for (const ch of s) {
    page.drawText(ch, { x: at, y: baseline, size, font: o.font, color: o.color ?? INK });
    at += o.font.widthOfTextAtSize(ch, size) + spacing;
  }
}

/** A small capitals label, as every box is named. */
function caps(k: Kit, page: PDFPage, s: string, x: number, y: number, align: 'left' | 'center' | 'right' = 'center', size = 5.6, color?: RGB, maxWidth?: number) {
  write(page, s.toUpperCase(), x, y, { font: k.fonts.semibold, size, color: color ?? k.accent, align, spacing: 0.55, maxWidth });
}

/** How tall a font's capitals stand at a size (from the font itself, so centring is exact). */
function capHeight(font: PDFFont, size: number): number {
  const f = (font as unknown as { embedder?: { font?: { capHeight?: number; unitsPerEm?: number } } }).embedder?.font;
  return f?.capHeight && f.unitsPerEm ? (f.capHeight / f.unitsPerEm) * size : 0.72 * size;
}

/** Capitals with their middle on a line at y, centered on x. */
function capsAt(page: PDFPage, s: string, font: PDFFont, size: number, x: number, y: number, spacing = 0, color = INK) {
  const total = font.widthOfTextAtSize(s, size) + spacing * Math.max(0, s.length - 1);
  let at = x - total / 2;
  const baseline = H - y - capHeight(font, size) / 2;
  for (const ch of spacing ? [...s] : [s]) {
    page.drawText(ch, { x: at, y: baseline, size, font, color });
    at += font.widthOfTextAtSize(ch, size) + spacing;
  }
}

/** A framed section with its name on a tab across the bottom edge, as on the paper sheet. */
function section(k: Kit, page: PDFPage, x: number, y: number, w: number, h: number, title?: string) {
  box(page, x, y, w, h, { stroke: INK, fill: WHITE, r: 7 });
  if (!title) return;
  const label = title.toUpperCase();
  const tw = k.fonts.semibold.widthOfTextAtSize(label, 5.8) + 0.55 * (label.length - 1) + 14;
  box(page, x + w / 2 - tw / 2, y + h - 6, tw, 12, { stroke: INK, fill: WHITE, r: 6, width: 0.8 });
  capsAt(page, label, k.fonts.semibold, 5.8, x + w / 2, y + h, 0.55);
}

/** A rounded gray well that a value sits in. */
const well = (page: PDFPage, x: number, y: number, w: number, h: number, r = 3) => box(page, x, y, w, h, { fill: WELL, r });

/** The die, as the app draws it (Logo.svelte), at a size. */
function logo(page: PDFPage, x: number, y: number, size: number, color: RGB) {
  const s = size / 48;
  const o = { x, y: H - y, scale: s, borderColor: color };
  page.drawSvgPath('M24 3 L43 14 L43 34 L24 45 L5 34 L5 14 Z', { ...o, borderWidth: 2 * s * 1.6 });
  page.drawSvgPath('M24 12 L34 29 L14 29 Z', { ...o, borderWidth: 1.6 * s * 1.6 });
  page.drawSvgPath('M24 12 L24 3 M24 12 L43 14 M24 12 L5 14 M34 29 L43 14 M34 29 L43 34 M34 29 L24 45 M14 29 L24 45 M14 29 L5 34 M14 29 L5 14',
    { ...o, borderWidth: 1 * s * 1.6, borderOpacity: 0.5 });
}

function brand(k: Kit, page: PDFPage) {
  // The die and the name share one middle line, as in the app's header.
  const size = 26;
  const middle = 33;
  logo(page, 34, middle - size / 2, size, INK);
  const name = 'DND COMPANION';
  const font = k.fonts.brand;
  const at = 34 + size + 7;
  page.drawText(name, { x: at, y: H - middle - capHeight(font, 15) / 2, size: 15, font, color: INK });
}

function footer(k: Kit, page: PDFPage) {
  const n = k.pages.indexOf(page) + 1;
  write(page, `${k.content.name}  ·  DND Companion character sheet  ·  page ${n}`, W / 2, 768, {
    font: k.fonts.regular, size: 5.8, color: MUTED, align: 'center'
  });
}

// ── Fields ───────────────────────────────────────────────────────────────

type FieldOpts = {
  size?: number;
  align?: 'left' | 'center' | 'right';
  multiline?: boolean;
  font?: 'regular' | 'semibold' | 'bold';
  color?: RGB;
  /** For long text: the same words already broken into lines. The box is
      drawn from these (quick), while the value kept is the running text, so
      an edit in a reader wraps it afresh. */
  shown?: string;
};

/** An editable box holding a value. A name seen before adds the same field again on this page. */
function field(k: Kit, page: PDFPage, name: string, value: string, x: number, y: number, w: number, h: number, o: FieldOpts = {}) {
  const form = k.doc.getForm();
  // A one-line box shows what fits its width; the whole value is kept, and a
  // reader scrolls to the rest. (Its look is not clipped, so it would
  // otherwise run over the boxes beside it.)
  if (!o.multiline && o.shown === undefined && value) {
    const font = k.fonts[o.font ?? 'regular'];
    const size = o.size ?? 8;
    const room = w - 4;
    if (font.widthOfTextAtSize(value, size) > room) {
      let end = value.length;
      while (end > 1 && font.widthOfTextAtSize(value.slice(0, end), size) > room) end--;
      const cut = value.slice(0, end);
      const space = cut.lastIndexOf(' ');
      o = { ...o, shown: (space > end / 2 ? cut.slice(0, space) : cut).replace(/[;,\s]+$/, '') };
    }
  }
  let f = k.fields.get(name);
  if (!f) {
    f = form.createTextField(name);
    if (o.multiline) f.enableMultiline();
    f.disableRichFormatting();
    f.setText(o.shown ?? value ?? '');
    f.setAlignment(o.align === 'center' ? TextAlignment.Center : o.align === 'right' ? TextAlignment.Right : TextAlignment.Left);
    // The size is set before the box is placed: placing it draws its look,
    // and a size left at "auto" makes that slow for a long text.
    f.acroField.setDefaultAppearance(`/Helv ${o.size ?? 8} Tf 0 g`);
    k.fields.set(name, f);
  }
  f.addToPage(page, {
    x, y: H - y - h, width: w, height: h,
    borderWidth: 0, borderColor: undefined, backgroundColor: undefined, textColor: o.color ?? VALUE,
    font: k.fonts[o.font ?? 'regular']
  });
  if (o.shown !== undefined) f.acroField.setValue(PDFHexString.fromText(value ?? ''));
  return f;
}

function checkbox(k: Kit, page: PDFPage, name: string, on: boolean, cx: number, cy: number, r = 4) {
  circle(page, cx, cy, r, { stroke: INK, fill: WHITE, width: 0.8 });
  const cb = k.doc.getForm().createCheckBox(name);
  cb.addToPage(page, { x: cx - r + 1, y: H - cy - r + 1, width: 2 * r - 2, height: 2 * r - 2, borderWidth: 0, borderColor: undefined, backgroundColor: undefined, textColor: VALUE });
  // Ticked, it fills the circle, as the app's own bubbles do; not ticked, nothing is drawn over the circle.
  cb.updateAppearances((_box, widget) => {
    const { width, height } = widget.getRectangle();
    const fill = [
      pushGraphicsState(),
      ...drawEllipse({ x: width / 2, y: height / 2, xScale: width / 2 - 0.4, yScale: height / 2 - 0.4, color: VALUE, borderColor: undefined, borderWidth: 0 }),
      popGraphicsState()
    ];
    return { normal: { on: fill, off: [] }, down: { on: fill, off: [] } };
  });
  if (on) cb.check();
}

// ── Text that may not fit ────────────────────────────────────────────────

type Line = { text: string; /** Last line of its paragraph. */ end: boolean; /** Broken inside a word. */ glued: boolean };

/** Lines as a reader will wrap them in a box this wide. */
function wrap(text: string, font: PDFFont, size: number, width: number): Line[] {
  const out: Line[] = [];
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= width;
  for (const para of text.split('\n')) {
    if (!para.trim()) {
      out.push({ text: '', end: true, glued: false });
      continue;
    }
    let current = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = current ? `${current} ${word}` : word;
      if (fits(next)) {
        current = next;
        continue;
      }
      if (current) out.push({ text: current, end: false, glued: false });
      // A word wider than the box is broken, never cut.
      let rest = word;
      while (!fits(rest)) {
        let i = rest.length - 1;
        while (i > 1 && !fits(rest.slice(0, i))) i--;
        out.push({ text: rest.slice(0, i), end: false, glued: true });
        rest = rest.slice(i);
      }
      current = rest;
    }
    out.push({ text: current, end: true, glued: false });
  }
  return out;
}

/** Lines back into text: a paragraph's lines run on, so the reader wraps it again if it is edited. */
const unwrap = (lines: Line[]) =>
  lines.map((l, i) => l.text + (i === lines.length - 1 ? '' : l.end ? '\n' : l.glued ? '' : ' ')).join('');

/** How many lines of this size a box holds (pdf-lib sets lines 1.2 × the font's height apart). */
const capacity = (font: PDFFont, size: number, height: number) => Math.max(1, Math.floor((height - 4) / (font.heightAtSize(size) * 1.2)) - 1);

/**
 * Pours text into a run of boxes: as many lines as fit go in the first, the
 * rest into the next. The sheet never grows pages: whatever is left after
 * the last box is kept in that box's field, which shows what fits and
 * scrolls in a reader to the rest.
 */
function pour(k: Kit, text: string, boxes: { page: PDFPage; name: string; x: number; y: number; w: number; h: number }[], size: number): void {
  let lines = wrap(text ?? '', k.fonts.regular, size, Math.max(10, (boxes[0]?.w ?? 20) - 8));
  boxes.forEach((b, bi) => {
    const room = capacity(k.fonts.regular, size, b.h);
    if (bi === boxes.length - 1 && lines.length > room) {
      field(k, b.page, b.name, unwrap(lines), b.x, b.y, b.w, b.h, { multiline: true, size, shown: lines.slice(0, room).map((l) => l.text).join('\n') });
      lines = [];
      return;
    }
    let take = lines.slice(0, room);
    let rest = lines.slice(room);
    // A heading never ends a box: it goes over with what it heads.
    while (take.length > 1 && rest.length && take[take.length - 1].end && /^[A-Z0-9 &·()'’-]+$/.test(take[take.length - 1].text) && take[take.length - 1].text.length > 2) {
      rest = [take[take.length - 1], ...rest];
      take = take.slice(0, -1);
    }
    while (take.length && !take[take.length - 1].text.trim()) take = take.slice(0, -1);
    while (rest.length && !rest[0].text.trim()) rest = rest.slice(1);
    if (take.length) take[take.length - 1] = { ...take[take.length - 1], end: true };
    field(k, b.page, b.name, unwrap(take), b.x, b.y, b.w, b.h, { multiline: true, size, shown: take.map((l) => l.text).join('\n') });
    lines = rest;
  });
}

/**
 * A list cut to its rows: what does not fit joins the last row, column by
 * column ("Rope; Torch"), so nothing is lost and no page is added.
 */
function fold<T extends Record<string, string>>(list: T[], rows: number): T[] {
  if (list.length <= rows) return list;
  const last = list.slice(rows - 1);
  const merged = Object.fromEntries(
    Object.keys(last[0]).map((key) => [key, last.map((it) => it[key]).filter((v) => v && v.trim()).join('; ')])
  ) as T;
  return [...list.slice(0, rows - 1), merged];
}

const paragraphs = (list: Paragraph[]) =>
  list
    .map((p) => (p.head ? `${p.head}` : [p.title ? `${p.title}.` : '', p.body ?? ''].filter(Boolean).join(' ')))
    .join('\n\n');

// ── Pages ────────────────────────────────────────────────────────────────

function newPage(k: Kit): PDFPage {
  const page = k.doc.addPage([W, H]);
  k.pages.push(page);
  brand(k, page);
  return page;
}

/** The name box, and the facts beside it in two rows. */
function header(k: Kit, page: PDFPage, rows: { name: string; label: string; value: string; w: number }[][], nameLabel = 'Character name', nameValue?: string, nameField = 'CharacterName') {
  well(page, 34, 56, 196, 30, 5);
  field(k, page, nameField, nameValue ?? k.content.name, 40, 59, 184, 24, { size: 14, font: 'bold' });
  caps(k, page, nameLabel, 38, 90, 'left');
  box(page, 248, 22, 336, 78, { stroke: INK, fill: WHITE, r: 7 });
  rows.forEach((row, ri) => {
    let x = 258;
    const top = 32 + ri * 34;
    for (const cell of row) {
      field(k, page, cell.name, cell.value, x, top, cell.w - 6, 15, { size: 8.5 });
      line(page, x, top + 16, x + cell.w - 8, top + 16, SOFT, 0.7);
      caps(k, page, cell.label, x, top + 19.5, 'left', 5.2, MUTED, cell.w - 8);
      x += cell.w;
    }
  });
}

const mainHeaderRows = (c: SheetContent) => [
  [
    { name: 'ClassLevel', label: 'Class & level', value: c.classAndLevel, w: 214 },
    { name: 'PlayerName', label: 'Player name', value: c.player, w: 102 }
  ],
  [
    { name: 'Species', label: 'Species', value: c.species, w: 112 },
    { name: 'Background', label: 'Background', value: c.background, w: 102 },
    { name: 'ExperiencePoints', label: 'Experience points', value: c.xp, w: 102 }
  ]
];

function pageOne(k: Kit) {
  const c = k.content;
  const p = newPage(k);
  header(k, p, mainHeaderRows(c));

  // Ability scores, down the left.
  c.abilities.forEach((a, i) => {
    const y = 112 + i * 77;
    section(k, p, 28, y, 62, 72);
    caps(k, p, a.name, 59, y + 8, 'center', 5.4, undefined, 56);
    field(k, p, `${a.key.toUpperCase()}`, a.score, 32, y + 17, 54, 26, { size: 19, font: 'bold', align: 'center' });
    box(p, 41, y + 49, 36, 17, { stroke: INK, fill: WHITE, r: 8.5, width: 0.8 });
    field(k, p, `${a.key.toUpperCase()}mod`, a.mod, 42, y + 50.5, 34, 14, { size: 9.5, font: 'semibold', align: 'center' });
  });

  // Saving throws.
  section(k, p, 96, 112, 112, 162, 'Saving throws');
  c.saves.forEach((s, i) => {
    const y = 121 + i * 13.6;
    circle(p, 104, y + 5, 3.4, { stroke: INK, fill: WHITE, width: 0.7 });
    field(k, p, `${s.key}SaveProf`, s.prof, 100, y + 0.5, 8, 9, { size: 6, align: 'center' });
    well(p, 110, y - 0.5, 20, 11, 2.5);
    field(k, p, `${s.key}Save`, s.value, 110, y - 0.5, 20, 11, { size: 7.5, font: 'semibold', align: 'center' });
    write(p, s.name, 134, y + 1.5, { font: k.fonts.regular, size: 7.2, color: VALUE });
  });
  caps(k, p, 'Saving throw modifiers', 152, 205, 'center', 5, MUTED);
  field(k, p, 'SaveModifiers', c.saveModifiers, 101, 213, 102, 52, { multiline: true, size: 6.6 });

  // Skills.
  section(k, p, 96, 282, 112, 302, 'Skills');
  const skillRows = [...c.skills, { key: 'custom1', name: '', ability: '', prof: '', value: '' }, { key: 'custom2', name: '', ability: '', prof: '', value: '' }];
  skillRows.forEach((s, i) => {
    const y = 290 + i * 13.85;
    circle(p, 104, y + 5, 3.4, { stroke: INK, fill: WHITE, width: 0.7 });
    field(k, p, `${s.key}Prof`, s.prof, 100, y + 0.5, 8, 9, { size: 6, align: 'center' });
    well(p, 110, y - 0.5, 20, 11, 2.5);
    field(k, p, `${s.key}Skill`, s.value, 110, y - 0.5, 20, 11, { size: 7.5, font: 'semibold', align: 'center' });
    if (s.name) {
      write(p, s.name, 134, y + 1.5, { font: k.fonts.regular, size: 7.1, color: VALUE, maxWidth: 52 });
      write(p, s.ability, 202, y + 2.3, { font: k.fonts.semibold, size: 5, color: MUTED, align: 'right', spacing: 0.3 });
    } else {
      field(k, p, `${s.key}Name`, '', 133, y - 0.5, 70, 11, { size: 7.1 });
      line(p, 134, y + 10.5, 202, y + 10.5);
    }
  });

  // Senses.
  section(k, p, 28, 592, 180, 160, 'Senses');
  c.passives.forEach((ps, i) => {
    const y = 601 + i * 24;
    well(p, 36, y, 28, 19, 4);
    field(k, p, `Passive${i + 1}`, ps.value, 36, y, 28, 19, { size: 10, font: 'bold', align: 'center' });
    caps(k, p, ps.label, 70, y + 7, 'left', 5.2, INK, 132);
  });
  field(k, p, 'Senses', c.senses, 34, 674, 168, 66, { multiline: true, size: 7.2 });

  // Initiative and armor class.
  section(k, p, 216, 112, 84, 74, 'Initiative');
  field(k, p, 'Initiative', c.initiative, 222, 128, 72, 26, { size: 19, font: 'bold', align: 'center' });
  if (c.initiativeNote) write(p, c.initiativeNote, 258, 157, { font: k.fonts.italic, size: 6, color: MUTED, align: 'center' });
  // A plain heater shield of the app's own, round at the shoulders.
  p.drawSvgPath('M 6 0 H 66 Q 72 0 72 6 V 30 C 72 50 56 62 36 72 C 16 62 0 50 0 30 V 6 Q 0 0 6 0 Z', {
    x: 309, y: H - 112, borderColor: INK, borderWidth: 0.9, color: WHITE
  });
  caps(k, p, 'Armor', 345, 120, 'center', 5.4);
  field(k, p, 'AC', c.ac, 318, 130, 54, 26, { size: 19, font: 'bold', align: 'center' });
  caps(k, p, 'Class', 345, 160, 'center', 5.4);

  section(k, p, 216, 194, 176, 54, 'Defenses');
  field(k, p, 'Defenses', c.defenses, 222, 199, 164, 38, { multiline: true, size: 7.4 });

  const bar = (y: number, h: number, label: string, name: string, value: string) => {
    box(p, 216, y, 176, h, { stroke: INK, fill: WHITE, r: h / 2 });
    circle(p, 216 + h / 2, y + h / 2, h / 2 - 3, { fill: WELL });
    field(k, p, name, value, 216 + 3, y + 3, h - 6, h - 6, { size: 9.5, font: 'bold', align: 'center' });
    caps(k, p, label, 216 + h + 8, y + h / 2 - 2.4, 'left', 6, INK);
  };
  bar(256, 24, 'Heroic inspiration', 'Inspiration', c.inspiration);
  bar(288, 24, 'Proficiency bonus', 'ProfBonus', c.proficiency);
  bar(320, 24, 'Ability save DC', 'AbilitySaveDC', c.abilitySaveDc);

  section(k, p, 216, 352, 176, 52, 'Speed');
  field(k, p, 'Speed', c.speed, 222, 360, 164, 30, { multiline: true, size: 10, font: 'semibold', align: 'center' });

  // Hit points.
  section(k, p, 400, 112, 184, 74, 'Hit points');
  const hpCells: [string, string, string, number, number][] = [
    ['Max HP', 'MaxHP', c.hpMax, 408, 50],
    ['Current HP', 'CurrentHP', c.hpCurrent, 464, 56],
    ['Temp HP', 'TempHP', c.hpTemp, 526, 50]
  ];
  for (const [label, name, value, x, w] of hpCells) {
    caps(k, p, label, x + w / 2, 120, 'center', 5.2, MUTED);
    well(p, x, 129, w, 36, 5);
    field(k, p, name, value, x, 133, w, 28, { size: name === 'CurrentHP' ? 19 : 15, font: 'bold', align: 'center' });
  }

  section(k, p, 400, 194, 88, 54, 'Hit dice');
  caps(k, p, 'Total', 408, 202, 'left', 5, MUTED);
  field(k, p, 'HDTotal', c.hitDiceTotal, 428, 199, 54, 11, { size: 7.5, font: 'semibold' });
  line(p, 428, 210.5, 482, 210.5);
  field(k, p, 'HD', c.hitDiceLeft, 406, 214, 76, 20, { size: 9, align: 'center' });

  section(k, p, 496, 194, 88, 54, 'Death saves');
  caps(k, p, 'Successes', 503, 203, 'left', 4.8, MUTED);
  caps(k, p, 'Failures', 503, 220, 'left', 4.8, MUTED);
  for (let i = 0; i < 3; i++) {
    checkbox(k, p, `DeathSuccess${i + 1}`, c.deathSaves.successes > i, 549 + i * 11, 205, 3.8);
    checkbox(k, p, `DeathFailure${i + 1}`, c.deathSaves.failures > i, 549 + i * 11, 222, 3.8);
  }

  section(k, p, 400, 256, 184, 148, 'Proficiencies & languages');
  field(k, p, 'ProficienciesLang', c.profLang, 406, 262, 172, 130, { multiline: true, size: 7.2 });

  // Actions: what is limited and what is chosen, in two columns.
  section(k, p, 216, 412, 368, 172, 'Actions');
  pour(k, [c.actions, c.actionsMore].filter(Boolean).join('\n\n'), [
    { page: p, name: 'Actions1', x: 222, y: 418, w: 174, h: 154 },
    { page: p, name: 'Actions2', x: 404, y: 418, w: 174, h: 154 }
  ], 7);

  // Weapon attacks and cantrips.
  section(k, p, 216, 592, 368, 160, 'Weapon attacks & cantrips');
  const cols: [string, number, number][] = [['Name', 224, 112], ['Hit / DC', 340, 34], ['Damage / type', 378, 70], ['Notes', 452, 124]];
  for (const [label, x] of cols) caps(k, p, label, x + 2, 600, 'left', 5, MUTED);
  const ROWS = 7;
  const attacks = fold(c.attacks, ROWS);
  for (let i = 0; i < ROWS; i++) {
    const a = attacks[i] ?? { name: '', hit: '', damage: '', notes: '' };
    const y = 609 + i * 18.6;
    const keys = ['name', 'hit', 'damage', 'notes'] as const;
    cols.forEach(([, x, w], j) => {
      well(p, x, y, w, 15, 3);
      field(k, p, `Wpn${i + 1}${['Name', 'Hit', 'Damage', 'Notes'][j]}`, a[keys[j]], x + 1, y, w - 2, 15, {
        size: j === 0 ? 7.6 : 7, font: j === 0 ? 'semibold' : 'regular', align: j === 1 ? 'center' : 'left'
      });
    });
  }
  footer(k, p);
}

function pageTwo(k: Kit) {
  const c = k.content;
  const p = newPage(k);
  header(k, p, mainHeaderRows(c));

  section(k, p, 28, 112, 556, 372, 'Features & traits');
  pour(k, paragraphs(c.features), [0, 1, 2].map((i) => ({ page: p, name: `FeaturesTraits${i + 1}`, x: 34 + i * 183, y: 119, w: 178, h: 352 })), 7);

  section(k, p, 28, 492, 556, 260, 'Equipment');
  // Coins and what the character can carry, down the left.
  c.coins.forEach((coin, i) => {
    const y = 501 + i * 25;
    capsAt(p, coin.key.toUpperCase(), k.fonts.semibold, 6, 36 + k.fonts.semibold.widthOfTextAtSize(coin.key.toUpperCase(), 6) / 2 + 0.3, y + 9, 0.55);
    well(p, 52, y, 48, 18, 4);
    field(k, p, coin.key.toUpperCase(), coin.value, 52, y, 48, 18, { size: 9, font: 'semibold', align: 'center' });
  });
  const carry: [string, string, string][] = [['Weight carried', 'WeightCarried', c.weightCarried], ['Encumbered', 'Encumbered', c.encumbered], ['Push · drag · lift', 'PushDragLift', c.pushDragLift]];
  carry.forEach(([label, name, value], i) => {
    const y = 632 + i * 33;
    caps(k, p, label, 36, y, 'left', 5, MUTED, 66);
    well(p, 36, y + 8, 64, 16, 3.5);
    field(k, p, name, value, 37, y + 8, 62, 16, { size: 8, align: 'center' });
  });
  line(p, 110, 500, 110, 738, SOFT, 0.6);

  // Each table is a band [x, x + width]: name, amount and weight side by
  // side, the two tables a clear gap apart.
  const QTY = 24;
  const WEIGHT = 32;
  const table = (x: number, width: number, top: number, rows: number, list: { name: string; qty: string; weight: string }[], prefix: string, start: number) => {
    const nameW = width - QTY - WEIGHT - 4;
    const qx = x + nameW + 2;
    const wx = qx + QTY + 2;
    caps(k, p, 'Name', x + 2, top, 'left', 5, MUTED);
    caps(k, p, 'Qty', qx + QTY / 2, top, 'center', 5, MUTED);
    caps(k, p, 'Weight', wx + WEIGHT / 2, top, 'center', 5, MUTED);
    for (let i = 0; i < rows; i++) {
      const it = list[i] ?? { name: '', qty: '', weight: '' };
      const y = top + 8 + i * 14.6;
      if (i % 2 === 0) box(p, x, y, width, 13.4, { fill: BAND, r: 2.5 });
      field(k, p, `${prefix}Name${start + i}`, it.name, x + 2, y, nameW - 2, 13.4, { size: 7 });
      field(k, p, `${prefix}Qty${start + i}`, it.qty, qx, y, QTY, 13.4, { size: 7, align: 'center' });
      field(k, p, `${prefix}Weight${start + i}`, it.weight, wx, y, WEIGHT, 13.4, { size: 7, align: 'center' });
    }
  };
  const A = 15;
  const B = 10;
  const items = fold(c.items, A + B);
  table(116, 226, 500, A, items, 'Eq', 0);
  table(352, 226, 500, B, items.slice(A), 'Eq', A);
  caps(k, p, 'Attuned magic items', 354, 664, 'left', 5.4);
  table(352, 226, 674, 3, fold(c.attuned, 3), 'Attuned', 0);
  footer(k, p);
}

async function portrait(url: string): Promise<{ bytes: Uint8Array; png: boolean } | null> {
  if (!url || typeof document === 'undefined') return null;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    const loaded = new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('image'));
      setTimeout(() => rej(new Error('slow')), 8000);
    });
    img.src = url;
    await loaded;
    // Drawn into a canvas so any format (WebP, GIF…) becomes a PNG the PDF can hold.
    const max = 600;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return null;
    return { bytes: new Uint8Array(await blob.arrayBuffer()), png: true };
  } catch {
    // A host that won't share its pictures with other sites: the box stays empty to draw or paste in.
    return null;
  }
}

async function pageThree(k: Kit, picture: { bytes: Uint8Array; png: boolean } | null) {
  const c = k.content;
  const d = c.details;
  const p = newPage(k);
  header(k, p, [
    [
      { name: 'Gender', label: 'Gender', value: d.gender, w: 66 },
      { name: 'Age', label: 'Age', value: d.age, w: 62 },
      { name: 'Size', label: 'Size', value: d.size, w: 62 },
      { name: 'Height', label: 'Height', value: d.height, w: 64 },
      { name: 'Weight', label: 'Weight', value: d.weight, w: 62 }
    ],
    [
      { name: 'Alignment', label: 'Alignment', value: d.alignment, w: 66 },
      { name: 'Faith', label: 'Faith', value: d.faith, w: 62 },
      { name: 'Skin', label: 'Skin', value: d.skin, w: 62 },
      { name: 'Eyes', label: 'Eyes', value: d.eyes, w: 64 },
      { name: 'Hair', label: 'Hair', value: d.hair, w: 62 }
    ]
  ]);

  section(k, p, 28, 112, 182, 248, 'Character appearance');
  well(p, 36, 120, 166, 150, 5);
  if (picture) {
    try {
      const img = picture.png ? await k.doc.embedPng(picture.bytes) : await k.doc.embedJpg(picture.bytes);
      const fit = img.scaleToFit(160, 144);
      p.drawImage(img, { x: 36 + (166 - fit.width) / 2, y: H - 120 - 3 - fit.height - (144 - fit.height) / 2, width: fit.width, height: fit.height });
    } catch {
      /* left empty */
    }
  }
  pour(k, c.appearance, [{ page: p, name: 'Appearance', x: 34, y: 274, w: 170, h: 74 }], 7);

  section(k, p, 216, 112, 180, 248, 'Allies & organizations');
  pour(k, c.allies, [{ page: p, name: 'AlliesOrganizations', x: 222, y: 118, w: 168, h: 228 }], 7);

  const persona: [string, string, string][] = [
    ['Personality traits', 'PersonalityTraits', c.personality],
    ['Ideals', 'Ideals', c.ideals],
    ['Bonds', 'Bonds', c.bonds],
    ['Flaws', 'Flaws', c.flaws]
  ];
  persona.forEach(([label, name, value], i) => {
    const y = 112 + i * 63;
    section(k, p, 402, y, 182, 57, label);
    pour(k, value, [{ page: p, name, x: 408, y: y + 5, w: 170, h: 42 }], 7);
  });

  section(k, p, 28, 368, 556, 384, 'Additional notes');
  pour(k, c.notes, [0, 1].map((i) => ({ page: p, name: `AdditionalNotes${i + 1}`, x: 36 + i * 274, y: 375, w: 266, h: 364 })), 7.4);
  footer(k, p);
}

const SPELL_COLS: [string, number, number, 'left' | 'center'][] = [
  ['Prep', 32, 14, 'center'],
  ['Spell name', 48, 104, 'left'],
  ['Source', 154, 66, 'left'],
  ['Save / hit', 222, 34, 'center'],
  ['Time', 258, 26, 'center'],
  ['Range', 286, 44, 'left'],
  ['Comp', 332, 30, 'left'],
  ['Duration', 364, 52, 'left'],
  ['Page', 418, 22, 'center'],
  ['Notes', 442, 136, 'left']
];
const SPELL_ROWS = 49;

/** Spells cut to the page: those past the last row join it, column by column. */
function foldSpells(rows: SheetContent['spellRows'], room: number): SheetContent['spellRows'] {
  if (rows.length <= room) return rows;
  const rest = rows.slice(room - 1).filter((r) => r.kind !== 'head');
  if (!rest.length) return rows.slice(0, room);
  const cells = rest[0].cells.map((_, j) => rest.map((r) => r.cells[j]).filter((v) => v && v.trim()).join('; '));
  return [...rows.slice(0, room - 1), { ...rest[0], cells }];
}

function spellPage(k: Kit, all: SheetContent['spellRows']) {
  const start = 0;
  const rows = foldSpells(all, SPELL_ROWS);
  const c = k.content;
  const p = newPage(k);
  well(p, 34, 56, 196, 30, 5);
  field(k, p, 'SpellcastingClass', c.spellcastingClass, 40, 59, 184, 24, { size: 12, font: 'bold' });
  caps(k, p, 'Spellcasting class', 38, 90, 'left');
  const tops: [string, string, string][] = [['Spellcasting ability', 'SpellcastingAbility', c.spellcastingAbility], ['Spell save DC', 'SpellSaveDC', c.spellSaveDc], ['Spell attack bonus', 'SpellAtkBonus', c.spellAttack]];
  tops.forEach(([label, name, value], i) => {
    const x = 252 + i * 112;
    section(k, p, x, 24, 104, 62);
    field(k, p, name, value, x + 8, 32, 88, 30, { size: 16, font: 'bold', align: 'center' });
    caps(k, p, label, x + 52, 72, 'center', 5.2, undefined, 96);
  });

  section(k, p, 28, 102, 556, 650, 'Spells');
  for (const [label, x, w, align] of SPELL_COLS) caps(k, p, label, align === 'center' ? x + w / 2 : x + 1, 111, align, 4.8, MUTED, w + 2);
  for (let i = 0; i < SPELL_ROWS; i++) {
    const r = rows[start + i];
    const y = 120 + i * 12.55;
    const n = start + i;
    if (r?.kind === 'head') {
      box(p, 32, y, 546, 11.6, { fill: k.wash, r: 2.5 });
      field(k, p, `SpellGroup${n}`, r.cells[0], 36, y, 538, 11.6, { size: 7, font: 'semibold', color: k.accent });
      continue;
    }
    if (i % 2 === 1) box(p, 32, y, 546, 11.6, { fill: BAND, r: 2.5 });
    if (!r) circle(p, 39, y + 5.8, 3, { stroke: SOFT, width: 0.6 });
    for (let j = 0; j < SPELL_COLS.length; j++) {
      const [, x, w, align] = SPELL_COLS[j];
      if (j === 0 && r) circle(p, 39, y + 5.8, 3, { stroke: INK, width: 0.6 });
      field(k, p, `Spell${n}_${j}`, r?.cells[j] ?? '', x, y, w, 11.6, {
        size: j === 0 ? 5.6 : j === 1 ? 7 : 6.2, align, font: j === 1 ? 'semibold' : 'regular'
      });
    }
  }
  footer(k, p);
}

type FontLoader = (file: string) => Promise<Uint8Array>;

async function loadFonts(doc: PDFDocument, get: FontLoader): Promise<Fonts> {
  const [regular, semibold, bold, italic, brandFont] = await Promise.all(
    ['Inter-Regular.ttf', 'Inter-SemiBold.ttf', 'Inter-Bold.ttf', 'Inter-Italic.ttf', 'CinzelDecorative-Bold.ttf'].map(get)
  );
  // Whole fonts (already trimmed to the letters a sheet uses), so text typed
  // into a field later still has every letter it needs.
  return {
    regular: await doc.embedFont(regular, { subset: false }),
    semibold: await doc.embedFont(semibold, { subset: false }),
    bold: await doc.embedFont(bold, { subset: false }),
    italic: await doc.embedFont(italic, { subset: false }),
    brand: await doc.embedFont(brandFont, { subset: true })
  };
}

/**
 * The finished PDF. `base` is where the site's files are (for the fonts);
 * `notes` only when the reader may see them.
 */
export async function sheetPdf(
  def: Definition,
  state: State,
  opts: { base?: string; notes?: string; loadFont?: FontLoader; picture?: { bytes: Uint8Array; png: boolean } | null }
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const content = sheetContent(def, state, { notes: opts.notes });
  doc.setTitle(`${content.name} · character sheet`);
  doc.setAuthor(content.player || 'DND Companion');
  doc.setCreator('DND Companion');
  doc.setProducer('DND Companion');
  doc.setSubject('Dungeons & Dragons 5e character sheet');

  // Grayscale, so it prints the same on any printer: the accent is black
  // and the spell levels' band a light gray. The portrait keeps its colors.
  const accent = INK;
  const wash = hexRgb('#e9e9e9');
  const load: FontLoader = opts.loadFont ?? (async (file) => new Uint8Array(await (await fetch(`${opts.base ?? ''}/pdf/${file}`)).arrayBuffer()));
  const [fonts, picture] = await Promise.all([loadFonts(doc, load), opts.picture !== undefined ? opts.picture : portrait(content.portraitUrl)]);
  const k: Kit = { doc, fonts, accent, wash, content, fields: new Map(), pages: [] };

  // The four pages of the paper sheet, never more.
  pageOne(k);
  pageTwo(k);
  await pageThree(k, picture);
  if (content.hasSpells) spellPage(k, content.spellRows);

  // The sheet's type, named for the form, so a reader that redraws a box
  // after an edit uses Inter rather than a stand-in.
  const acro = doc.getForm().acroForm.dict;
  const faces = [fonts.regular, fonts.semibold, fonts.bold];
  acro.set(PDFName.of('DR'), doc.context.obj({ Font: Object.fromEntries(faces.map((f) => [f.name, f.ref])) }));
  acro.set(PDFName.of('DA'), PDFString.of(`/${fonts.regular.name} 8 Tf 0 g`));

  // Each field's look was drawn as it was placed, in its own type (bold
  // numbers, plain text); saving must not redraw them all in one font.
  return doc.save({ updateFieldAppearances: false });
}
