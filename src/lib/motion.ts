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
