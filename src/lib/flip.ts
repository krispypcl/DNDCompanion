/**
 * Switching a sheet between reading and editing swaps every readout for an
 * input. They are built to take the same room, but around them rows grow,
 * edit-only fields appear and tables change columns, so words still move.
 * Rather than jump, each one glides from where it was to where it now is.
 *
 * Anything that should glide carries `data-flip="<key>"`, with the same key
 * on its reading and its editing element. `glide()` measures them all, makes
 * the change, then plays each one from its old place to its new one.
 */
import { tick } from 'svelte';
import { prefersReducedMotion } from './motion';

let counter = 0;
/** A key for one component instance, the same for both of its states. */
export const flipKey = (prefix = 'f') => `${prefix}${++counter}`;

const DURATION = 380;
const EASE = 'cubic-bezier(0.2, 0.8, 0.25, 1)';

function measure(): Map<string, DOMRect> {
  const out = new Map<string, DOMRect>();
  document.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width || r.height) out.set(el.dataset.flip!, r);
  });
  return out;
}

export async function glide(change: () => void): Promise<void> {
  if (typeof document === 'undefined' || prefersReducedMotion()) {
    change();
    return;
  }
  const before = measure();
  const scrollY = window.scrollY;
  change();
  await tick();
  // Rects are measured against the viewport; if the page scrolled because it
  // grew or shrank, that is not movement of the words.
  const dyScroll = window.scrollY - scrollY;
  const vh = window.innerHeight;
  document.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
    const was = before.get(el.dataset.flip!);
    if (!was) return;
    const now = el.getBoundingClientRect();
    // Nothing off screen either way needs animating.
    if ((now.bottom < 0 || now.top > vh) && (was.bottom < 0 || was.top > vh)) return;
    const dx = was.left - now.left;
    const dy = was.top - now.top - dyScroll;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
      duration: DURATION,
      easing: EASE
    });
  });
}
