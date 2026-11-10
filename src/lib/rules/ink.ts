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

/** How far a point is from a line segment. */
function toSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** How far apart two line segments come (0 where they cross). */
function between(a: number[], b: number[]): number {
  const [ax, ay, bx, by] = a;
  const [cx, cy, dx, dy] = b;
  const cross = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
  return Math.min(
    toSegment(ax, ay, cx, cy, dx, dy),
    toSegment(bx, by, cx, cy, dx, dy),
    toSegment(cx, cy, ax, ay, bx, by),
    toSegment(dx, dy, ax, ay, bx, by)
  );
}

/**
 * The lines an eraser swept over, moving from one point to the next: every
 * line that comes within its own half-width plus `pad` of that path. Points
 * are flat [x, y, x, y, …] lists, as strokes keep them.
 */
export function swept(lines: { p: number[]; w: number }[], from: [number, number], to: [number, number], pad: number): number[] {
  const path = [from[0], from[1], to[0], to[1]];
  const lo = [Math.min(from[0], to[0]), Math.min(from[1], to[1])];
  const hi = [Math.max(from[0], to[0]), Math.max(from[1], to[1])];
  const hits: number[] = [];
  lines.forEach((line, i) => {
    const p = line.p;
    if (p.length < 2) return;
    const reach = (line.w || 0) / 2 + pad;
    for (let j = 0; j + 1 < p.length; j += 2) {
      // A quick look at the area first: most of a page is nowhere near.
      const x2 = p.length >= j + 4 ? p[j + 2] : p[j];
      const y2 = p.length >= j + 4 ? p[j + 3] : p[j + 1];
      if (Math.max(p[j], x2) < lo[0] - reach || Math.min(p[j], x2) > hi[0] + reach) continue;
      if (Math.max(p[j + 1], y2) < lo[1] - reach || Math.min(p[j + 1], y2) > hi[1] + reach) continue;
      if (between(path, [p[j], p[j + 1], x2, y2]) <= reach) {
        hits.push(i);
        return;
      }
      if (p.length < j + 4) return;
    }
  });
  return hits;
}
