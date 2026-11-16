/**
 * The main menu's lists, cut into pages that fit the screen.
 *
 * A page has so much height for its cards. Each group (Pinned, the rest,
 * Retired) takes its name's height and whole rows of cards: a group that
 * doesn't fill its last row still takes the row. Counting cards instead let
 * a page with a pinned card run past the screen; counting the names' room
 * up front left a row's worth of the screen empty.
 */
export type Paged<T> = { items: T[]; label?: string };
export type PageSize = {
  /** Height for the groups on a page, in pixels. */
  room: number;
  /** One row of cards with the gap under it. */
  rowH: number;
  /** A group's name with the space around it. */
  nameH: number;
  /** Cards to a row. */
  cols: number;
};

export function paginate<G extends Paged<unknown>>(groups: G[], size: PageSize): G[][] {
  const cols = Math.max(1, Math.floor(size.cols));
  const rowH = Math.max(1, size.rowH);
  // Always room for a name and a row, however short the screen.
  const room = Math.max(size.room, size.nameH + rowH);
  const pages: G[][] = [];
  let page: G[] = [];
  let left = room;
  const turn = () => {
    pages.push(page);
    page = [];
    left = room;
  };
  for (const g of groups) {
    const nameH = g.label ? size.nameH : 0;
    let i = 0;
    while (i < g.items.length) {
      if (left < nameH + rowH && page.length) turn();
      const rows = Math.max(1, Math.floor((left - nameH) / rowH));
      const n = Math.min(g.items.length - i, rows * cols);
      page.push({ ...g, items: g.items.slice(i, i + n) });
      i += n;
      left -= nameH + Math.ceil(n / cols) * rowH;
      if (i < g.items.length) turn();
    }
  }
  if (page.length || !pages.length) pages.push(page);
  return pages;
}
