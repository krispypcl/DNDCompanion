/**
 * Small helpers shared by components.
 */

/**
 * Moves an element to the end of the page. A fixed overlay inside a frosted
 * panel (backdrop-filter) would be positioned against the panel instead of
 * the window; at the end of the page it is never inside one.
 */
export function portal(node: HTMLElement) {
  // Moved out to the page's end, it would lose the character's or campaign's
  // colour it was drawn inside: it takes that colour along (a theme is only
  // the variables --h and --c on a .themed element, see app.css).
  let host = node.parentElement?.closest<HTMLElement>('.themed') ?? null;
  while (host && !host.style.getPropertyValue('--h')) host = host.parentElement?.closest<HTMLElement>('.themed') ?? null;
  if (host && !node.classList.contains('themed')) {
    for (const name of ['--h', '--c']) {
      const v = host.style.getPropertyValue(name);
      if (v) node.style.setProperty(name, v);
    }
    node.classList.add('themed');
  }
  document.body.appendChild(node);
  return { destroy: () => node.remove() };
}

/** A modifier as it is written: "+3", "-1", "+0". */
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
