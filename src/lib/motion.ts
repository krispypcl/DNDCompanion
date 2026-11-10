/**
 * One movement, used everywhere a view changes: a short fade with a small
 * rise. Keeping it in a single place is what makes the app feel like one
 * thing rather than a collection of animated parts.
 *
 * CSS animations are flattened by the `prefers-reduced-motion` block in
 * app.css, but Svelte transitions run in JavaScript and are not, so they ask
 * here instead.
 */
import { cubicOut } from 'svelte/easing';

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type RiseOptions = { y?: number; duration?: number; delay?: number };

export function rise(_node: Element, { y = 8, duration = 220, delay = 0 }: RiseOptions = {}) {
  const span = prefersReducedMotion() ? 0 : duration;
  return {
    duration: span,
    delay: span === 0 ? 0 : delay,
    easing: cubicOut,
    css: (t: number, u: number) => `opacity: ${t}; transform: translate3d(0, ${u * y}px, 0);`
  };
}

/**
 * The same arrival for a whole page. It moves the page by `top`, never by
 * `transform`: a transformed element becomes the frame its fixed children
 * are placed in, so the loading die (fixed, centred on the screen) would
 * appear in a corner and then jump to the middle. The element needs
 * `position: relative`.
 */
export function arrive(_node: Element, { y = 10, duration = 260, delay = 0 }: RiseOptions = {}) {
  const span = prefersReducedMotion() ? 0 : duration;
  return {
    duration: span,
    delay: span === 0 ? 0 : delay,
    easing: cubicOut,
    css: (t: number, u: number) => `opacity: ${t}; top: ${u * y}px;`
  };
}

/**
 * A number that changed gives a small pop, so the eye catches it: an ability
 * modifier after a score changes, a skill after proficiency is toggled, AC.
 * Not on the first render, only on a change. `kind` picks the effect:
 * "bump" (the pop), "glow" (a soft accent glow, for the level badge) or
 * "sparkle" (a burst, for gaining Inspiration; only when the value rises).
 */
function fx(node: HTMLElement, value: unknown, kind: 'bump' | 'glow' | 'sparkle') {
  let last = value;
  const fire = (cls: string) => {
    node.classList.remove(cls);
    void node.offsetWidth; // restart the animation
    node.classList.add(cls);
  };
  const end = (e: AnimationEvent) => {
    if (e.target === node) node.classList.remove('fx-bump', 'fx-glow', 'fx-sparkle');
  };
  node.addEventListener('animationend', end);
  return {
    update(next: unknown) {
      if (next === last) return;
      const rose = typeof next === 'number' && typeof last === 'number' ? next > last : true;
      last = next;
      if (kind === 'sparkle' && !rose) return fire('fx-bump');
      fire(`fx-${kind}`);
    },
    destroy() {
      node.removeEventListener('animationend', end);
    }
  };
}

export const bump = (node: HTMLElement, value: unknown) => fx(node, value, 'bump');
export const glow = (node: HTMLElement, value: unknown) => fx(node, value, 'glow');
export const sparkle = (node: HTMLElement, value: unknown) => fx(node, value, 'sparkle');

/**
 * A row arriving or leaving a list: it opens or closes its own height, and
 * fades, so the rows below it slide rather than jump.
 */
export function foldRow(node: Element, { duration = 240, x = -10 }: { duration?: number; x?: number } = {}) {
  const el = node as HTMLElement;
  const h = el.offsetHeight;
  const cs = getComputedStyle(el);
  const pt = parseFloat(cs.paddingTop) || 0;
  const pb = parseFloat(cs.paddingBottom) || 0;
  return {
    duration: prefersReducedMotion() ? 0 : duration,
    easing: (t: number) => 1 - Math.pow(1 - t, 3),
    css: (t: number, u: number) =>
      `overflow: hidden; opacity: ${t}; transform: translateX(${x * u}px); height: ${t * h}px;` +
      ` padding-top: ${t * pt}px; padding-bottom: ${t * pb}px;`
  };
}

/**
 * A box that eases to its new height when what is inside it grows or
 * shrinks (a chip arriving, a line wrapping), so what is below it, and the
 * card or row around it, slide rather than jump. Watches its first child.
 */
export function followHeight(node: HTMLElement) {
  const inner = node.firstElementChild as HTMLElement | null;
  if (!inner || typeof ResizeObserver === 'undefined') return;
  let last = inner.getBoundingClientRect().height;
  let running: Animation | null = null;
  const watch = new ResizeObserver(() => {
    const now = inner.getBoundingClientRect().height;
    if (Math.abs(now - last) < 0.5) return;
    const from = running ? node.getBoundingClientRect().height : last;
    last = now;
    running?.cancel();
    if (prefersReducedMotion()) return;
    running = node.animate([{ height: `${from}px`, overflow: 'hidden' }, { height: `${now}px`, overflow: 'hidden' }], {
      duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.25, 1)'
    });
    running.onfinish = () => (running = null);
  });
  watch.observe(inner);
  return { destroy: () => watch.disconnect() };
}

/**
 * A keyed item moving to its new place (animate:glideTo): it slides there,
 * and only slides. Svelte's own flip also scales an item whose size changed,
 * which squashed a card for a moment whenever its contents grew.
 */
export function glideTo(_node: Element, { from, to }: { from: DOMRect; to: DOMRect }, { duration = 260 } = {}) {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return { duration: 0 };
  return {
    duration: prefersReducedMotion() ? 0 : duration,
    easing: (t: number) => 1 - Math.pow(1 - t, 3),
    css: (_t: number, u: number) => `transform: translate(${u * dx}px, ${u * dy}px);`
  };
}
