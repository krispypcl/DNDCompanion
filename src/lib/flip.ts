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
let settle: ReturnType<typeof setTimeout> | undefined;
const EASE = 'cubic-bezier(0.2, 0.8, 0.25, 1)';

/** Boxes whose height changes between the two modes (a table): the box
    itself eases to its new height, so what follows it moves smoothly. */
function sizes(): Map<string, number> {
  const out = new Map<string, number>();
  document.querySelectorAll<HTMLElement>('[data-flip-size]').forEach((el) => {
    out.set(el.dataset.flipSize!, el.getBoundingClientRect().height);
  });
  return out;
}

/**
 * Things that exist in only one of the two modes carry `data-flip-ghost`: a
 * column shown only while editing, the portrait shown only while reading.
 * One that is going is copied first and the copy fades out where it stood;
 * one that is arriving fades in. Neither pops.
 */
type Ghost = { rect: DOMRect; copy: HTMLElement };
const COPIED = ['font', 'color', 'backgroundColor', 'border', 'borderRadius', 'padding', 'textAlign',
  'lineHeight', 'letterSpacing', 'textTransform', 'verticalAlign', 'boxShadow'] as const;

function ghosts(): Map<string, Ghost> {
  const out = new Map<string, Ghost>();
  const vh = window.innerHeight;
  document.querySelectorAll<HTMLElement>('[data-flip-ghost]').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > vh) return;
    const copy = el.cloneNode(true) as HTMLElement;
    const cs = getComputedStyle(el);
    for (const k of COPIED) copy.style[k] = cs[k];
    copy.style.display = cs.display.startsWith('table') ? 'block' : cs.display;
    copy.style.boxSizing = 'border-box';
    copy.style.width = `${rect.width}px`;
    copy.style.height = `${rect.height}px`;
    copy.style.margin = '0';
    copy.style.overflow = 'hidden';
    copy.removeAttribute('data-flip-ghost');
    copy.querySelectorAll('[data-flip], [data-flip-ghost], [id]').forEach((n) => {
      n.removeAttribute('data-flip');
      n.removeAttribute('data-flip-ghost');
      n.removeAttribute('id');
    });
    out.set(el.dataset.flipGhost!, { rect, copy });
  });
  return out;
}

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
  const heights = sizes();
  const leaving = ghosts();
  const had = new Set(
    Array.from(document.querySelectorAll<HTMLElement>('[data-flip-ghost]'), (el) => el.dataset.flipGhost!)
  );
  const scrollY = window.scrollY;
  // While things glide, a table's scroll box would flash a scrollbar for the
  // words passing over its edge; it is clipped instead until they settle.
  const root = document.documentElement;
  root.classList.add('gliding');
  clearTimeout(settle);
  settle = setTimeout(() => root.classList.remove('gliding'), DURATION + 80);
  change();
  await tick();
  // Rects are measured against the viewport; if the page scrolled because it
  // grew or shrank, that is not movement of the words.
  const dyScroll = window.scrollY - scrollY;
  document.querySelectorAll<HTMLElement>('[data-flip-size]').forEach((el) => {
    const was = heights.get(el.dataset.flipSize!);
    const now = el.getBoundingClientRect().height;
    if (was === undefined || Math.abs(was - now) < 1) return;
    el.animate([{ height: `${was}px` }, { height: `${now}px` }], { duration: DURATION, easing: EASE });
  });
  const vh = window.innerHeight;
  // What arrived fades in; what went fades out from where it was.
  const present = new Set<string>();
  document.querySelectorAll<HTMLElement>('[data-flip-ghost]').forEach((el) => {
    const key = el.dataset.flipGhost!;
    present.add(key);
    if (had.has(key)) return;
    el.animate([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], {
      duration: DURATION, delay: 60, easing: EASE, fill: 'backwards'
    });
  });
  for (const [key, { rect, copy }] of leaving) {
    if (present.has(key)) continue;
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    Object.assign(holder.style, {
      position: 'fixed', left: `${rect.left}px`, top: `${rect.top - dyScroll}px`,
      width: `${rect.width}px`, height: `${rect.height}px`, pointerEvents: 'none', zIndex: '30'
    });
    holder.appendChild(copy);
    document.body.appendChild(holder);
    const out = holder.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.96)' }], {
      duration: DURATION * 0.7, easing: 'ease-out', fill: 'forwards'
    });
    out.onfinish = () => holder.remove();
  }
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
