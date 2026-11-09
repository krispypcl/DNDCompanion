/**
 * Whether this device draws with a pen (an Apple Pencil). Once a pen has
 * drawn here, only the pen draws on the board and on notes: a palm resting
 * on the glass, or a finger, moves things instead. Remembered on the device,
 * so it holds from the very first stroke next time; the board's toolbar can
 * let fingers draw again.
 */
import { writable } from 'svelte/store';

const KEY = 'dndcompanion:pen-only';
function read(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const penOnly = writable(read());
penOnly.subscribe((on) => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Private browsing: it lasts for this visit.
  }
});

/** A pen was seen: from now on only it draws. */
export function sawPen() {
  penOnly.set(true);
}

/** A touch too large to be a fingertip: the side of a hand. */
export const isPalm = (e: PointerEvent) => e.pointerType === 'touch' && (e.width > 44 || e.height > 44);

/**
 * Safari on an iPad treats a pencil held still or tapped twice as the start
 * of its own gestures (selecting, the magnifier, Scribble, zooming), which
 * can swallow a stroke. On a drawing surface, a stylus touch is kept for
 * drawing. (Pointer events still arrive; only the browser's own handling
 * stops.)
 */
export function keepStylus(node: HTMLElement) {
  const stop = (e: TouchEvent) => {
    const t = e.changedTouches[0] as Touch & { touchType?: string };
    if (t?.touchType !== 'stylus') return;
    sawPen();
    const el = e.target as Element | null;
    if (el?.closest('button, input, textarea, select, a, [contenteditable="true"]')) return;
    if (e.cancelable) e.preventDefault();
  };
  node.addEventListener('touchstart', stop, { passive: false });
  node.addEventListener('touchmove', stop, { passive: false });
  return {
    destroy() {
      node.removeEventListener('touchstart', stop);
      node.removeEventListener('touchmove', stop);
    }
  };
}
