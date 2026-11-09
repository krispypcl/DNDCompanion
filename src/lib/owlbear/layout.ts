/**
 * What a token tied to a sheet carries, worked out from the token's size and
 * the sheet: a hit point bar along its bottom edge (and a thin blue one above
 * it for temporary hit points), and a dot for each coloured condition along
 * its top. Pure: the background page turns these into Owlbear shapes.
 */
import { vitalStatus } from '$lib/rules/hp';
import { lookOf } from '$lib/rules/conditions';
import type { Sheet } from '$lib/types';
import { toHex } from './colour';
import type { PartKind } from './keys';

export type Box = { x: number; y: number; w: number; h: number };
/** A rectangle by its top-left corner; a circle by its centre. */
export type Part = {
  kind: PartKind;
  shape: 'RECTANGLE' | 'CIRCLE';
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  opacity: number;
  stroke: string;
  strokeWidth: number;
  z: number;
};

/** The token's drawn box on the map, from its image, grid and scale. */
export function tokenBox(
  item: { position: { x: number; y: number }; scale: { x: number; y: number }; image: { width: number; height: number }; grid: { dpi: number; offset: { x: number; y: number } } },
  sceneDpi: number
): Box {
  const k = sceneDpi / (item.grid.dpi || sceneDpi);
  const sx = Math.abs(item.scale.x);
  const sy = Math.abs(item.scale.y);
  return {
    x: item.position.x - item.grid.offset.x * k * sx,
    y: item.position.y - item.grid.offset.y * k * sy,
    w: item.image.width * k * sx,
    h: item.image.height * k * sy
  };
}

export const VITAL_COLOURS: Record<string, string> = {
  healthy: '#4fbf6a',
  bloodied: '#e0a72e',
  critical: '#e5484d',
  down: '#8a8f98',
  stable: '#8a8f98',
  dead: '#5a5f68'
};
const TEMP = '#5aa6f0';
const MAX_DOTS = 6;

export function partsFor(box: Box, sheet: Sheet): Part[] {
  const out: Part[] = [];
  const max = Number(sheet.definition?.combat?.hpMax) || 0;
  const cur = Math.max(0, Number(sheet.state?.hpCurrent) || 0);
  const temp = Math.max(0, Number(sheet.state?.hpTemp) || 0);
  const w = box.w * 0.84;
  const h = Math.max(4, box.w * 0.07);
  const x = box.x + (box.w - w) / 2;
  const y = box.y + box.h - h * 1.6;
  if (max > 0) {
    const v = vitalStatus(cur, max, sheet.state?.deathSaves);
    out.push({ kind: 'hp-back', shape: 'RECTANGLE', x, y, w, h, fill: '#000000', opacity: 0.55, stroke: '#000000', strokeWidth: 0, z: 1 });
    const ratio = Math.min(1, cur / max);
    if (ratio > 0) out.push({ kind: 'hp-fill', shape: 'RECTANGLE', x, y, w: w * ratio, h, fill: VITAL_COLOURS[v.vital] ?? VITAL_COLOURS.healthy, opacity: 1, stroke: '#000000', strokeWidth: 0, z: 2 });
    if (temp > 0) {
      const th = h * 0.55;
      out.push({ kind: 'hp-temp', shape: 'RECTANGLE', x, y: y - th - h * 0.2, w: w * Math.min(1, temp / max), h: th, fill: TEMP, opacity: 1, stroke: '#000000', strokeWidth: 0, z: 2 });
    }
  }
  const looks = sheet.definition?.conditionLooks ?? {};
  const colours = (sheet.state?.conditions ?? []).map((c) => lookOf(c, looks)?.color).filter(Boolean) as string[];
  const d = Math.max(6, box.w * 0.16);
  colours.slice(0, MAX_DOTS).forEach((c, i) => {
    out.push({
      kind: `cond-${i}`, shape: 'CIRCLE',
      x: box.x + box.w - d * 0.55 - i * d * 0.9, y: box.y + d * 0.55, w: d, h: d,
      fill: toHex(c), opacity: 1, stroke: '#101014', strokeWidth: Math.max(1, d * 0.12), z: 3 + i
    });
  });
  return out;
}

/** Whether a drawn part already matches what it should be (to skip needless writes). */
export function sameParts(a: Part, b: Part): boolean {
  const near = (p: number, q: number) => Math.abs(p - q) < 0.5;
  return a.shape === b.shape && near(a.x, b.x) && near(a.y, b.y) && near(a.w, b.w) && near(a.h, b.h) &&
    a.fill === b.fill && Math.abs(a.opacity - b.opacity) < 0.01 && a.stroke === b.stroke && near(a.strokeWidth, b.strokeWidth);
}
