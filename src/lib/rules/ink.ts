/**
 * Drawing over a page of notes or backstory. A page's drawing is kept on a
 * last line of its own, after the writing (`INK_MARK` + JSON), so the page
 * stays one piece of text: saved, made private and exported with the words.
 * Points are in units of the page's width (0 to 1000), so a drawing scales
 * with the page.
 */
import { INK_MARK } from './richtext';

export type Paper = 'plain' | 'lines' | 'grid' | 'dots';
export type Stroke = { c: string; w: number; p: number[] };
export type Ink = { paper: Paper; s: Stroke[] };

export const blankInk = (): Ink => ({ paper: 'plain', s: [] });

/** The writing and the drawing of one page. */
export function splitInk(page: string): { text: string; ink: Ink | null } {
  const at = page.lastIndexOf(`\n${INK_MARK}`);
  const start = at >= 0 ? at + 1 : page.startsWith(INK_MARK) ? 0 : -1;
  if (start < 0) return { text: page, ink: null };
  const text = start === 0 ? '' : page.slice(0, at);
  try {
    const raw = JSON.parse(page.slice(start + INK_MARK.length)) as Partial<Ink>;
    const paper: Paper = ['lines', 'grid', 'dots'].includes(raw.paper as string) ? (raw.paper as Paper) : 'plain';
    const s = Array.isArray(raw.s)
      ? raw.s.filter((st): st is Stroke => Boolean(st && typeof st.c === 'string' && Array.isArray(st.p)))
      : [];
    return { text, ink: { paper, s } };
  } catch {
    return { text, ink: null };
  }
}

/** One page again; a drawing with nothing in it leaves no line behind. */
export function joinInk(text: string, ink: Ink | null): string {
  if (!ink || (ink.paper === 'plain' && ink.s.length === 0)) return text;
  const json = JSON.stringify({ paper: ink.paper, s: ink.s.map((st) => ({ c: st.c, w: st.w, p: st.p.map((n) => Math.round(n)) })) });
  return `${text}\n${INK_MARK}${json}`;
}
