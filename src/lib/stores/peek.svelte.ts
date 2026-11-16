/**
 * The 5e.tools peek: one small window, shared by the whole app, that shows
 * the entry under the pointer without leaving the sheet. Links ask for it
 * (`hoverPeek` on a name, `peek.show` on a tap); LookupPeek, mounted once in
 * the layout, draws it.
 */
import { peekTarget } from '$lib/rules/peek';

/** How long the pointer rests on a name before the window opens. */
const HOVER_OPEN_MS = 450;
/** Grace to cross the gap from the name to the window before it closes. */
const HOVER_CLOSE_MS = 280;

export type PeekTarget = {
  name: string;
  url: string;
  /** Where the name sits on screen, so the window can open on the far side of it. */
  anchor: DOMRect;
  /** The character's colours, where the name sits on a themed sheet. */
  hue?: string;
  chroma?: string;
};

class Peek {
  target = $state<PeekTarget | null>(null);
  /** Kept open: hovering elsewhere swaps what it shows, leaving never closes it. */
  pinned = $state(false);
  /** The pointer is over the window itself. */
  inside = $state(false);
  /** Opened by a click or tap (not a resting pointer), so only ×, Esc or a press outside closes it. */
  tapped = $state(false);

  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #closeTimer: ReturnType<typeof setTimeout> | undefined;

  show(target: PeekTarget, { tapped = false } = {}) {
    this.#clear();
    if (!peekTarget(target.url)) return;
    this.target = target;
    this.tapped = tapped;
  }

  /** The pointer settled on a name: open after a moment, unless it moves on. */
  hoverIn(get: () => PeekTarget | null) {
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
  hoverOut() {
    clearTimeout(this.#openTimer);
    this.#scheduleClose();
  }

  enter() {
    this.inside = true;
    clearTimeout(this.#closeTimer);
  }

  leave() {
    this.inside = false;
    this.#scheduleClose();
  }

  close() {
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
