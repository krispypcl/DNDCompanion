/**
 * Small helpers shared by components.
 */

/**
 * Moves an element to the end of the page. A fixed overlay inside a frosted
 * panel (backdrop-filter) would be positioned against the panel instead of
 * the window; at the end of the page it is never inside one.
 */
export function portal(node: HTMLElement) {
  document.body.appendChild(node);
  return { destroy: () => node.remove() };
}

/** A modifier as it is written: "+3", "-1", "+0". */
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
