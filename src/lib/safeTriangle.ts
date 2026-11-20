/**
 * A safe triangle, for a pop-up opened by hovering (the 5e.tools peek): the
 * triangle from where the pointer left what opened it to the two corners of
 * the pop-up's near side. While the pointer moves inside it, it is on its way
 * to the pop-up, so the pop-up stays open and nothing the pointer crosses on
 * the way (another name) opens instead.
 */
export type Point = { x: number; y: number };

/** Is `p` on the way from `from` to `to`? `slack` widens the near side a little. */
export function inSafeTriangle(from: Point, to: DOMRect, p: Point, slack = 8): boolean {
  let a: Point;
  let b: Point;
  if (to.left >= from.x) [a, b] = [{ x: to.left, y: to.top - slack }, { x: to.left, y: to.bottom + slack }];
  else if (to.right <= from.x) [a, b] = [{ x: to.right, y: to.top - slack }, { x: to.right, y: to.bottom + slack }];
  else if (to.top >= from.y) [a, b] = [{ x: to.left - slack, y: to.top }, { x: to.right + slack, y: to.top }];
  else if (to.bottom <= from.y) [a, b] = [{ x: to.left - slack, y: to.bottom }, { x: to.right + slack, y: to.bottom }];
  else return true; // It left from inside the pop-up's own box.
  return inTriangle(p, from, a, b);
}

function inTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const side = (u: Point, v: Point, w: Point) => (u.x - w.x) * (v.y - w.y) - (v.x - w.x) * (u.y - w.y);
  const d1 = side(p, a, b);
  const d2 = side(p, b, c);
  const d3 = side(p, c, a);
  const negative = d1 < 0 || d2 < 0 || d3 < 0;
  const positive = d1 > 0 || d2 > 0 || d3 > 0;
  return !(negative && positive);
}
