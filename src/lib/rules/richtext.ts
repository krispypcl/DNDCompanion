/**
 * Formatting for notes and backstory, kept as readable text.
 *
 * The writing is stored (and exported) as plain text with a few marks, so a
 * downloaded file still reads like a note:
 *
 *   **bold**   *italic*   __underline__   ~~strikethrough~~
 *   ## Heading           - bulleted item       1. numbered item
 *   [[c:red|coloured]]   [[h:yellow|highlighted]]   [[s:big|bigger]]
 *
 * On the page it is shown formatted, and edited formatted too: `toHtml` turns
 * the text into the editor's HTML, and `fromHtml` turns what the editor holds
 * back into text. Everything typed is escaped before any mark is read, so no
 * HTML from the text can reach the page, and a literal `*` the writer typed
 * is stored escaped (`\*`) so it is never taken for a mark.
 */

export type Format = 'bold' | 'italic' | 'underline' | 'strike' | 'heading' | 'bullets' | 'numbers';

/** Colour, highlight and size: a kind and one of its named values. */
export type MarkKind = 'c' | 'h' | 's';
export const MARKS: Record<MarkKind, readonly string[]> = {
  c: ['red', 'orange', 'gold', 'lime', 'green', 'teal', 'blue', 'purple', 'pink', 'brown', 'grey', 'none'],
  h: ['yellow', 'green', 'blue', 'pink', 'purple', 'orange', 'none'],
  s: ['small', 'big', 'huge', 'none']
};
const MARK = /\[\[([chs]):([a-z]+)\|((?:(?!\[\[)[^])*?)\]\]/g;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Characters a writer may type that would otherwise start or end a mark. */
const ESCAPABLE = /\\([\\*_~#\-.0-9[\]])/g;

/** Marks inside one line, on text that is already HTML-escaped. */
function inline(text: string): string {
  // Escaped characters are set aside first so no rule below can see them.
  const kept: string[] = [];
  let s = text.replace(ESCAPABLE, (_, ch: string) => {
    kept.push(ch);
    return `\u0000${kept.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/\*\*(\S(?:[^]*?\S)?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(\S(?:[^]*?\S)?)__/g, '<u>$1</u>');
  s = s.replace(/~~(\S(?:[^]*?\S)?)~~/g, '<s>$1</s>');
  s = s.replace(/\*(\S(?:[^]*?\S)?)\*/g, '<em>$1</em>');
  // Colour, highlight and size, innermost first, so they can sit inside each other.
  for (let guard = 0; guard < 8; guard++) {
    const next = s.replace(MARK, (_, k: MarkKind, v: string, inner: string) =>
      MARKS[k].includes(v) ? `<span data-${k}="${v}">${inner}</span>` : inner
    );
    if (next === s) break;
    s = next;
  }
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => escapeHtml(kept[Number(i)]));
}

const BULLET = /^- (.*)$/;
const NUMBERED = /^\d+\. (.*)$/;
const HEADING = /^## (.*)$/;

export function toHtml(text: string): string {
  const lines = (text ?? '').split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const line of lines) {
    // A page's drawing rides along on a line of its own; it is not writing.
    if (line.startsWith(INK_MARK)) continue;
    const b = line.match(BULLET);
    const n = line.match(NUMBERED);
    const want = b ? 'ul' : n ? 'ol' : null;
    if (want !== list) {
      close();
      if (want) {
        out.push(`<${want}>`);
        list = want;
      }
    }
    if (b || n) {
      out.push(`<li>${inline((b ?? n)![1]) || '<br>'}</li>`);
      continue;
    }
    const h = line.match(HEADING);
    if (h) out.push(`<h3>${inline(h[1]) || '<br>'}</h3>`);
    else out.push(`<div>${inline(line) || '<br>'}</div>`);
  }
  close();
  return out.join('');
}

/** The start of the line that carries a page's drawing (see rules/ink.ts). */
export const INK_MARK = '\u2063ink:';

/** True when there is nothing in the text but whitespace. */
export const isEmptyText = (text: string) => (text ?? '').trim() === '';

// ── From the editor back to text ───────────────────────────────────────────

const BLOCK = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE']);

/** A typed character that would read as a mark is escaped. */
function escapeText(s: string): string {
  return s.replace(/[\u200b\ufeff]/g, '').replace(/\u00a0/g, ' ').replace(/[\\*~[\]]/g, (c) => `\\${c}`).replace(/__/g, '\\_\\_');
}

/** The marks for a run of inline content. */
function inlineOf(node: Node): string {
  let out = '';
  node.childNodes.forEach((child) => {
    out += inlineNode(child);
  });
  return out;
}

function wrap(mark: string, inner: string): string {
  // A mark around nothing, or around only spaces, is dropped; spaces at the
  // edges move outside it, since `** bold**` is not a mark.
  const m = inner.match(/^(\s*)([^]*?)(\s*)$/)!;
  if (!m[2]) return inner;
  return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}

function inlineNode(node: Node): string {
  if (node.nodeType === 3) return escapeText(node.textContent ?? '');
  if (node.nodeType !== 1) return '';
  const el = node as HTMLElement;
  const tag = el.tagName;
  if (tag === 'BR') return '\n';
  const inner = inlineOf(el);
  const style = el.getAttribute('style') ?? '';
  if (tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/.test(style)) return wrap('**', inner);
  if (tag === 'I' || tag === 'EM' || /font-style:\s*italic/.test(style)) return wrap('*', inner);
  if (tag === 'U' || /text-decoration[^;]*underline/.test(style)) return wrap('__', inner);
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || /text-decoration[^;]*line-through/.test(style)) {
    return wrap('~~', inner);
  }
  // Colour, highlight, size: kept by name, so a theme can draw them its own way.
  let out = inner;
  for (const k of ['s', 'h', 'c'] as MarkKind[]) {
    const v = el.getAttribute(`data-${k}`) ?? (tag === 'FONT' ? el.getAttribute('face')?.match(new RegExp(`^dnd-${k}-([a-z]+)$`))?.[1] : null);
    if (v && MARKS[k].includes(v) && out.trim()) out = `[[${k}:${v}|${out}]]`;
  }
  return out;
}

/** A line that would read as a heading or list item, but is not one, is escaped. */
function plainLine(s: string): string {
  if (/^(## |- |\d+\. )/.test(s)) return `\\${s}`;
  return s;
}

export function fromHtml(root: HTMLElement): string {
  const lines: string[] = [];
  let current = '';
  let open = false;
  const flush = () => {
    // Loose content with nothing in it — an empty text node, an emptied <b>,
    // a stray <br> — is what the browser leaves behind after formatting, not
    // a line the writer wrote. Counting it added a blank line above the
    // first line whenever that line was made bold.
    if (open && current.trim() !== '') lines.push(...current.split('\n').map(plainLine));
    current = '';
    open = false;
  };
  const walk = (parent: Node) => {
    parent.childNodes.forEach((node) => {
      if (node.nodeType === 1 && BLOCK.has((node as HTMLElement).tagName)) {
        const el = node as HTMLElement;
        flush();
        if (el.tagName === 'UL' || el.tagName === 'OL') {
          let n = 0;
          el.childNodes.forEach((li) => {
            if (li.nodeType !== 1) return;
            n += 1;
            const text = inlineOf(li).replace(/\n+$/, '').replace(/\n/g, ' ');
            lines.push(el.tagName === 'UL' ? `- ${text}` : `${n}. ${text}`);
          });
        } else if (/^H[1-6]$/.test(el.tagName)) {
          lines.push(`## ${inlineOf(el).replace(/\n+$/, '').replace(/\n/g, ' ')}`);
        } else if (el.tagName === 'LI') {
          lines.push(`- ${inlineOf(el).replace(/\n+$/, '')}`);
        } else {
          // A block holding only a <br> is an empty line.
          const hasBlocks = [...el.childNodes].some((c) => c.nodeType === 1 && BLOCK.has((c as HTMLElement).tagName));
          if (hasBlocks) walk(el);
          else {
            const text = inlineOf(el);
            lines.push(...(text === '\n' ? [''] : text.replace(/\n$/, '').split('\n').map(plainLine)));
          }
        }
        return;
      }
      current += inlineNode(node);
      open = true;
    });
  };
  walk(root);
  flush();
  // Trailing empty lines the editor leaves behind are not part of the writing.
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}
