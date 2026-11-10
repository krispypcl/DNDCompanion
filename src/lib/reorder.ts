/**
 * Putting a row of chips (conditions) in another order by picking one up and
 * moving it, the way apps move on a phone's home screen, without the shake.
 * There is no grip: with a mouse a chip lifts once it is dragged a few
 * pixels; on a touch screen, once it is held still for a moment (so a swipe
 * still scrolls). The lifted chip grows a little and follows the pointer;
 * the others slide aside as it passes (the list shows the new order through
 * `onpreview`, and its `animate:flip` moves them); let go, it settles into
 * its place and the order is kept (`oncommit`).
 *
 * The list element takes `use:reorder`; each chip is a direct child with
 * `data-key`. Buttons and fields inside a chip stay buttons and fields.
 */
import { tick } from 'svelte';
import { prefersReducedMotion } from './motion';

export type ReorderOptions = {
  enabled: boolean;
  keys: string[];
  /** The order to show while dragging; null when the drag ends or is called off. */
  onpreview: (keys: string[] | null) => void;
  oncommit: (keys: string[]) => void;
  /** How much the picked-up item grows: chips a little, whole cards hardly. */
  scale?: number;
};

const HOLD = 280;
const SLOP_MOUSE = 4;
const SLOP_TOUCH = 8;
const LIFT = 1.08;

type Box = { left: number; top: number; w: number; h: number };
/** Where a chip sits in the list, ignoring any transform it is moving with. */
const boxOf = (el: HTMLElement): Box => ({ left: el.offsetLeft, top: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight });

export function reorder(node: HTMLElement, options: ReorderOptions) {
  let o = options;
  let pending: { key: string; el: HTMLElement; x: number; y: number; id: number; touch: boolean; timer?: ReturnType<typeof setTimeout> } | null = null;
  let drag: { key: string; el: HTMLElement; gx: number; gy: number; order: string[]; id: number; x: number; y: number } | null = null;

  const chips = () => Array.from(node.children).filter((c): c is HTMLElement => c instanceof HTMLElement && c.dataset.key !== undefined);
  /** A point on screen, in the list's own coordinates (those of offsetLeft). */
  function local(x: number, y: number) {
    const r = node.getBoundingClientRect();
    return { px: x - r.left - node.clientLeft, py: y - r.top - node.clientTop };
  }

  function down(e: PointerEvent) {
    if (!o.enabled || o.keys.length < 2 || e.button !== 0 || pending || drag) return;
    const target = e.target as Element;
    const el = target.closest<HTMLElement>('[data-key]');
    if (!el || el.parentElement !== node) return;
    if (target.closest('button, input, select, textarea, label')) return;
    const touch = e.pointerType !== 'mouse';
    pending = { key: el.dataset.key!, el, x: e.clientX, y: e.clientY, id: e.pointerId, touch };
    if (touch) pending.timer = setTimeout(() => lift(), HOLD);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  function lift() {
    if (!pending) return;
    const { key, el, x, y, id } = pending;
    clearTimeout(pending.timer);
    pending = null;
    const { px, py } = local(x, y);
    const box = boxOf(el);
    drag = { key, el, gx: px - box.left, gy: py - box.top, order: [...o.keys], id, x, y };
    node.classList.add('reordering');
    el.classList.add('held');
    // Held long enough on a phone: a tick to say it is picked up.
    if (navigator.vibrate) try { navigator.vibrate(8); } catch { /* not allowed here */ }
    el.style.setProperty('transition', prefersReducedMotion() ? 'none' : 'transform 0.16s ease-out', 'important');
    place();
    setTimeout(() => drag?.el === el && el.style.setProperty('transition', 'none', 'important'), 170);
  }

  /** Keeps the lifted chip under the pointer, wherever its slot now is. */
  function place() {
    if (!drag) return;
    const { px, py } = local(drag.x, drag.y);
    const box = boxOf(drag.el);
    const tx = px - drag.gx - box.left;
    const ty = py - drag.gy - box.top;
    // Important, so the list's own glide (animate:flip) does not take it back.
    drag.el.style.setProperty('transform', `translate(${tx}px, ${ty}px) scale(${o.scale ?? LIFT})`, 'important');
  }

  async function follow(x: number, y: number) {
    if (!drag) return;
    drag.x = x;
    drag.y = y;
    const { px, py } = local(x, y);
    const others = chips().filter((c) => c !== drag!.el);
    let next: string[] | null = null;
    for (const c of others) {
      const b = boxOf(c);
      if (px < b.left || px > b.left + b.w || py < b.top || py > b.top + b.h) continue;
      const rest = drag.order.filter((k) => k !== drag!.key);
      const at = rest.indexOf(c.dataset.key!);
      // A row of chips is ordered across; a column of cards, down.
      const before = b.w > node.clientWidth * 0.6 ? py < b.top + b.h / 2 : px < b.left + b.w / 2;
      rest.splice(before ? at : at + 1, 0, drag.key);
      next = rest;
      break;
    }
    if (next && next.join('\u0000') !== drag.order.join('\u0000')) {
      drag.order = next;
      o.onpreview(next);
      await tick();
    }
    place();
  }

  function move(e: PointerEvent) {
    if (pending && e.pointerId === pending.id) {
      const far = Math.hypot(e.clientX - pending.x, e.clientY - pending.y);
      if (pending.touch) {
        // Moved before the hold: a swipe, so the page scrolls as usual.
        if (far > SLOP_TOUCH) stop();
        return;
      }
      if (far > SLOP_MOUSE) {
        lift();
        void follow(e.clientX, e.clientY);
      }
      return;
    }
    if (drag && e.pointerId === drag.id) {
      e.preventDefault();
      void follow(e.clientX, e.clientY);
    }
  }

  /** Lets the chip glide from under the pointer into its place. */
  function settle(el: HTMLElement) {
    el.classList.remove('held');
    node.classList.remove('reordering');
    if (prefersReducedMotion()) {
      el.style.removeProperty('transform');
      el.style.removeProperty('transition');
      return;
    }
    el.style.setProperty('transition', 'transform 0.3s cubic-bezier(0.2, 0.8, 0.25, 1)', 'important');
    el.style.setProperty('transform', 'translate(0px, 0px) scale(1)', 'important');
    const done = () => {
      el.style.removeProperty('transform');
      el.style.removeProperty('transition');
    };
    el.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 360);
  }

  function up(e: PointerEvent) {
    if (pending && e.pointerId === pending.id) return stop();
    if (!drag || e.pointerId !== drag.id) return;
    const { el, order } = drag;
    drag = null;
    stop();
    // The drag ends in a click on the chip (a link, perhaps): not this time.
    const swallow = (ev: Event) => {
      ev.preventDefault();
      ev.stopPropagation();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    if (order.join('\u0000') !== o.keys.join('\u0000')) o.oncommit(order);
    o.onpreview(null);
    settle(el);
  }

  function cancel() {
    if (drag) {
      const el = drag.el;
      drag = null;
      o.onpreview(null);
      settle(el);
    }
    stop();
  }

  function stop() {
    if (pending) clearTimeout(pending.timer);
    pending = null;
    if (drag) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
  }

  // Once a chip is up, a finger moving it must not scroll the page; and a
  // long press must not bring up the phone's own menu for the link.
  const touchmove = (e: TouchEvent) => {
    if (drag) e.preventDefault();
  };
  const menu = (e: Event) => {
    if (pending?.touch || drag) e.preventDefault();
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && drag) cancel();
  };
  const dragstart = (e: DragEvent) => {
    if ((e.target as Element).closest?.('[data-key]') && o.enabled) e.preventDefault();
  };
  node.addEventListener('pointerdown', down);
  node.addEventListener('touchmove', touchmove, { passive: false });
  node.addEventListener('contextmenu', menu);
  node.addEventListener('dragstart', dragstart);
  window.addEventListener('keydown', key);

  return {
    update(next: ReorderOptions) {
      o = next;
    },
    destroy() {
      cancel();
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('touchmove', touchmove);
      node.removeEventListener('contextmenu', menu);
      node.removeEventListener('dragstart', dragstart);
      window.removeEventListener('keydown', key);
    }
  };
}
