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
  // color it was drawn inside: it takes that color along (a theme is only
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

/**
 * A dialog opens with its first field or button ready for the keyboard.
 * After the moment it mounts: a portal around it moves it to the page's end
 * first, and moving a focused element takes the focus away again.
 */
export function focusFirst(node: HTMLElement) {
  queueMicrotask(() => (node.querySelector('input, button') as HTMLElement | null)?.focus());
}

/**
 * The dimmed page behind a window: pressed, it closes the window. Only a
 * press that starts and ends on the backdrop counts, so selecting text in
 * the window and letting go past its edge leaves the window open (a click
 * goes to whatever both ends of the press share, which is the backdrop).
 */
export function backdrop(node: HTMLElement, onpress: () => void) {
  let started = false;
  const down = (e: PointerEvent) => (started = e.target === node);
  const click = (e: MouseEvent) => {
    if (started && e.target === node) onpress();
    started = false;
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('click', click);
  return {
    update(next: () => void) {
      onpress = next;
    },
    destroy() {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('click', click);
    }
  };
}

/** A modifier as it is written: "+3", "-1", "+0". */
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * A pop-up the reader can move out of the way: pressed on its title (or
 * header) and dragged, it follows the pointer, kept on the screen. Buttons,
 * fields, and links in the title still work as they are. It moves by the
 * `translate` property, so it never fights the pop-up's own placing or its
 * opening animation. A new `key` (the pop-up opening on something else)
 * puts it back where it would be when it next opens.
 */
type MovableOptions = {
  handle?: string;
  key?: unknown;
  /** Off (a phone's bottom sheet): it stays where it is put. */
  enabled?: boolean;
  /** After a drag that moved it: where it now stands. */
  ondrop?: (rect: DOMRect) => void;
};
export function movable(node: HTMLElement, opts: MovableOptions = {}) {
  let handle = opts.handle ?? 'header, h2';
  let key = opts.key;
  let enabled = opts.enabled ?? true;
  let ondrop = opts.ondrop;
  let moved = false;
  let dx = 0;
  let dy = 0;
  let from: { x: number; y: number; dx: number; dy: number; id: number } | null = null;
  const mark = () => (enabled ? (node.dataset.movable = '') : delete node.dataset.movable);
  mark();
  const apply = () => (node.style.translate = dx || dy ? `${dx}px ${dy}px` : '');
  const reset = () => {
    dx = dy = 0;
    apply();
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || !enabled) return;
    const t = e.target as Element | null;
    const grip = t?.closest(handle);
    if (!grip || !node.contains(grip) || t?.closest('button, a, input, select, textarea, label, [contenteditable="true"]')) return;
    from = { x: e.clientX, y: e.clientY, dx, dy, id: e.pointerId };
    moved = false;
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
    moved ||= Math.abs(e.clientX - from.x) + Math.abs(e.clientY - from.y) > 3;
    apply();
  };
  const up = (e: PointerEvent) => {
    if (!from || e.pointerId !== from.id) return;
    from = null;
    delete node.dataset.moving;
    if (moved) ondrop?.(node.getBoundingClientRect());
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
  return {
    update(next: MovableOptions = {}) {
      handle = next.handle ?? 'header, h2';
      enabled = next.enabled ?? true;
      ondrop = next.ondrop;
      mark();
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

/**
 * A text box that follows its words: at least its `rows`, and taller as the
 * text grows, so a long answer is all on screen rather than behind an inner
 * scrollbar. Pass the value (or anything that changes with it) so a value
 * set from outside fits too; `false` leaves the box alone.
 */
export function fitText(node: HTMLTextAreaElement, value: unknown = true) {
  let on = value !== false;
  const fit = () => {
    if (!on) return;
    node.style.height = 'auto';
    const cs = getComputedStyle(node);
    const edge = cs.boxSizing === 'border-box'
      ? parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
      : -(parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom));
    node.style.height = `${node.scrollHeight + edge}px`;
  };
  fit();
  node.addEventListener('input', fit);
  return {
    update(next: unknown) {
      on = next !== false;
      if (on) requestAnimationFrame(fit);
    },
    destroy: () => node.removeEventListener('input', fit)
  };
}
