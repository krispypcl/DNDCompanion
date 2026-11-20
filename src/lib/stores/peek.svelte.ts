/**
 * The 5e.tools peek: one small window, shared by the whole app, that shows
 * the entry under the pointer without leaving the sheet. Links ask for it
 * (`hoverPeek` on a name, `peek.show` on a tap); LookupPeek, mounted once in
 * the layout, draws it.
 */
import { peekTarget } from '#lib/rules/peek.ts';
import { inSafeTriangle, type Point } from '#lib/safeTriangle.ts';

/** How long the pointer rests on a name before the window opens. */
const HOVER_OPEN_MS = 450;
/** Grace to cross the gap from the name to the window before it closes. */
const HOVER_CLOSE_MS = 280;

export type PeekTarget = {
  name: string;
  url: string;
  /** Where the name sits on screen, so the window can open on the far side of it. */
  anchor: DOMRect;
  /** The character's colors, where the name sits on a themed sheet. */
  hue?: string;
  chroma?: string;
};

/** A peek moved aside: its own window that stays where it was put until closed. */
export type KeptPeek = {
  id: number; target: PeekTarget; left: number; top: number; width: number;
  /** Opened from the search, so it fades in (one moved aside is already on screen). */
  opened?: boolean;
  /** Came from the search: always kept, so it has no pin to let it go, only its ×. */
  fromSearch?: boolean;
  /** How many times it has been sent somewhere new: each time, it glides there from where it was. */
  moves?: number;
};

class Peek {
  target = $state<PeekTarget | null>(null);
  /** Peeks moved aside, oldest first (the last drawn on top). */
  kept = $state<KeptPeek[]>([]);
  #next = 1;
  /** Kept open: hovering elsewhere swaps what it shows, leaving never closes it. */
  pinned = $state(false);
  /** The pointer is over the window itself. */
  inside = $state(false);
  /** Opened by a click or tap (not a resting pointer), so only ×, Esc or a press outside closes it. */
  tapped = $state(false);

  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #closeTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Where the pointer left the name of the open peek, while it may be on its
   * way to the window (lib/safeTriangle). LookupPeek gives the window's box.
   */
  #aim: Point | null = null;
  box: () => DOMRect | null = () => null;
  #heading(p: Point): boolean {
    const r = this.box();
    return Boolean(this.#aim && r && inSafeTriangle(this.#aim, r, p));
  }

  show(target: PeekTarget, { tapped = false } = {}) {
    this.#clear();
    if (!peekTarget(target.url)) return;
    this.quiet = false;
    this.target = target;
    this.tapped = tapped;
  }

  /** The pointer settled on a name: open after a moment, unless it moves on. */
  hoverIn(get: () => PeekTarget | null, at?: Point) {
    // Crossing a name on the way to the open window: that one doesn't open.
    if (at && this.#heading(at)) return;
    clearTimeout(this.#closeTimer);
    clearTimeout(this.#openTimer);
    // Already showing this one: nothing to wait for.
    const now = get();
    if (now && this.target?.url === now.url) return;
    this.#openTimer = setTimeout(() => {
      const target = get();
      if (target) this.show(target, { tapped: false });
    }, HOVER_OPEN_MS);
  }

  /** The pointer left the name: close soon, unless it reaches the window. */
  hoverOut(at?: Point) {
    clearTimeout(this.#openTimer);
    this.#aim = this.target && at ? at : null;
    this.#scheduleClose();
  }

  /** The pointer moved while the peek is open outside it: heading for the window holds it open. */
  moved(at: Point) {
    if (!this.#aim || this.inside) return;
    if (this.#heading(at)) this.#scheduleClose();
    else this.#aim = null;
  }

  enter() {
    this.inside = true;
    this.#aim = null;
    clearTimeout(this.#closeTimer);
  }

  leave() {
    this.inside = false;
    this.#scheduleClose();
  }

  /**
   * The open peek was dragged: it stays where it was put, as a window of its
   * own, and the next name opens a new peek beside that one.
   */
  keep(rect: DOMRect) {
    const target = this.target;
    if (!target) return;
    const had = this.kept.find((k) => k.target.url === target.url);
    if (had) this.#moveTo(had, rect.left, rect.top, rect.width);
    else this.kept = [...this.kept, { id: this.#next++, target, left: rect.left, top: rect.top, width: rect.width }];
    this.close({ quietly: true });
  }

  /**
   * The same entry asked for again while it is already open in a window: that
   * window comes to the front and glides to the new place (PeekWindow), rather
   * than a second one opening there and the first closing after it.
   */
  #moveTo(k: KeptPeek, left: number, top: number, width: number) {
    this.kept = [...this.kept.filter((x) => x.id !== k.id), { ...k, left, top, width, opened: false, moves: (k.moves ?? 0) + 1 }];
  }

  /**
   * Opened from the search: straight into a window of its own, at the right
   * of the screen, each next one a step down and left of the last, so
   * several stay readable. On a phone, the ordinary peek (a sheet from the
   * bottom) instead.
   */
  open(target: PeekTarget) {
    if (!peekTarget(target.url)) return;
    if (typeof window === 'undefined' || window.innerWidth < 640) {
      this.show(target, { tapped: true });
      return;
    }
    const width = Math.min(400, window.innerWidth - 24);
    const had = this.kept.find((k) => k.target.url === target.url);
    // Each next one a step down and left of the last; one already open takes the step a new one would.
    const step = ((had ? this.kept.length - 1 : this.kept.length) % 6) * 28;
    const left = Math.max(12, window.innerWidth - width - 24 - step);
    if (had) this.#moveTo(had, left, 72 + step, width);
    else this.kept = [...this.kept, { id: this.#next++, target, left, top: 72 + step, width, opened: true, fromSearch: true }];
  }

  /** A kept window to the front. */
  front(id: number) {
    const k = this.kept.find((x) => x.id === id);
    if (k && this.kept.at(-1) !== k) this.kept = [...this.kept.filter((x) => x.id !== id), k];
  }

  drop(id: number) {
    this.kept = this.kept.filter((k) => k.id !== id);
  }

  /** Closed without its fade (it became a kept window in the same place). */
  quiet = $state(false);

  close({ quietly = false } = {}) {
    this.quiet = quietly;
    this.#aim = null;
    this.#clear();
    this.target = null;
    this.pinned = false;
    this.tapped = false;
    this.inside = false;
  }

  #scheduleClose() {
    clearTimeout(this.#closeTimer);
    if (!this.target || this.pinned || this.tapped) return;
    this.#closeTimer = setTimeout(() => {
      if (!this.inside && !this.pinned && !this.tapped) this.close();
    }, HOVER_CLOSE_MS);
  }

  #clear() {
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
  }
}

export const peek = new Peek();

/** The character's accent where an element sits, so the window wears it too. */
export function themeAt(el: Element): { hue?: string; chroma?: string } {
  const style = getComputedStyle(el);
  return {
    hue: style.getPropertyValue('--h').trim() || undefined,
    chroma: style.getPropertyValue('--c').trim() || undefined
  };
}
