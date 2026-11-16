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

/**
 * A pop-up the reader can move out of the way: pressed on its title (or
 * header) and dragged, it follows the pointer, kept on the screen. Buttons,
 * fields and links in the title still work as they are. It moves by the
 * `translate` property, so it never fights the pop-up's own placing or its
 * opening animation. A new `key` (the pop-up opening on something else)
 * puts it back where it would be when it next opens.
 */
export function movable(node: HTMLElement, opts: { handle?: string; key?: unknown } = {}) {
  let handle = opts.handle ?? 'header, h2';
  let key = opts.key;
  let dx = 0;
  let dy = 0;
  let from: { x: number; y: number; dx: number; dy: number; id: number } | null = null;
  node.dataset.movable = '';
  const apply = () => (node.style.translate = dx || dy ? `${dx}px ${dy}px` : '');
  const reset = () => {
    dx = dy = 0;
    apply();
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as Element | null;
    const grip = t?.closest(handle);
    if (!grip || !node.contains(grip) || t?.closest('button, a, input, select, textarea, label, [contenteditable="true"]')) return;
    from = { x: e.clientX, y: e.clientY, dx, dy, id: e.pointerId };
    node.setPointerCapture?.(e.pointerId);
    node.dataset.moving = '';
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!from || e.pointerId !== from.id) return;
    // Where it would sit with no offset, so it can be kept on screen.
    const r = node.getBoundingClientRect();
    const left = r.left - dx;
    const top = r.top - dy;
    const m = 8;
    dx = Math.min(Math.max(from.dx + e.clientX - from.x, m - left), window.innerWidth - m - r.width - left);
    dy = Math.min(Math.max(from.dy + e.clientY - from.y, m - top), window.innerHeight - m - Math.min(r.height, 48) - top);
    apply();
  };
  const up = (e: PointerEvent) => {
    if (!from || e.pointerId !== from.id) return;
    from = null;
    delete node.dataset.moving;
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  return {
    update(next: { handle?: string; key?: unknown } = {}) {
      handle = next.handle ?? 'header, h2';
      // Back in place when it opens again (a new truthy key), not as it closes.
      if (next.key !== key) {
        key = next.key;
        if (key) reset();
      }
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
    }
  };
}
