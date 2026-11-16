/**
 * No scrollbar flashes while things move.
 *
 * An animation can push a box past its edges for a moment: a card folding
 * away while its copy arrives in another group, a row rising into place, a
 * panel easing to a new height. Transforms and passing heights count as
 * overflow, so a page or a panel that doesn't scroll would show a scrollbar
 * for that moment and take it away again.
 *
 * So when anything starts to animate, each box around it that scrolls but
 * has nothing to scroll right then is held still (`data-settling`, overflow
 * hidden; app.css) until every animation on the page has finished. A box
 * that really scrolls is left alone, and so are animations that never end
 * (the "here" dot, a skeleton's shimmer, the rolling die).
 *
 * It watches every way the app animates: Svelte's transitions and `flip`
 * and our own `el.animate` calls (all the Web Animations API), and CSS
 * animations and transitions (their start events), so new animations are
 * covered without doing anything.
 */

const ATTR = 'data-settling';
const held = new Set<Element>();
let checking = 0;
let safety: ReturnType<typeof setTimeout> | undefined;
/** When the hold began: kept a few frames at least, as some animations start a frame after the change. */
let heldAt = 0;

/** A box that scrolls (or would) on either axis. */
function scrolls(el: Element): boolean {
  if (el === document.documentElement) return true;
  const s = getComputedStyle(el);
  return /auto|scroll/.test(s.overflowY) || /auto|scroll/.test(s.overflowX);
}

/** Nothing to scroll in it right now. */
function still(el: Element): boolean {
  return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
}

/*
 * The page itself is judged by how it was before the change, not at the
 * moment the animation starts: by then the new card is already in place and
 * the page already looks taller than the screen. So whether it scrolls is
 * noted whenever it changes size with nothing moving (and on a resize).
 */
let pageStill = true;
function moving(): boolean {
  return document.getAnimations().some((a) => {
    if (a.playState !== 'running') return false;
    const end = a.effect?.getComputedTiming().endTime;
    return typeof end === 'number' && Number.isFinite(end);
  });
}
function notePage() {
  if (held.size || moving()) return;
  pageStill = still(document.documentElement);
}

function hold(from: Element | null) {
  for (let el: Element | null = from; el; el = el.parentElement) {
    if (held.has(el) || el.hasAttribute(ATTR)) continue;
    const page = el === document.documentElement;
    if (page ? pageStill && el.scrollTop === 0 : scrolls(el) && still(el)) {
      el.setAttribute(ATTR, '');
      held.add(el);
    }
  }
  if (held.size) {
    heldAt = performance.now();
    clearTimeout(safety);
    // Whatever happens, nothing stays held for long.
    safety = setTimeout(release, 3000);
  }
}

function release() {
  for (const el of held) el.removeAttribute(ATTR);
  held.clear();
  clearTimeout(safety);
  requestAnimationFrame(notePage);
}

/** Once no animation that ends is still running, let the boxes go. */
function check() {
  // Nothing held: once things are still, note how the page stands now.
  if (!held.size) {
    requestAnimationFrame(notePage);
    return;
  }
  if (checking) return;
  checking = requestAnimationFrame(() => {
    checking = 0;
    if (!moving() && performance.now() - heldAt > 100) release();
    else setTimeout(check, 50);
  });
}

let installed = false;

/** Set it up once, in the browser (the root layout). */
export function installSettle(): void {
  if (installed || typeof window === 'undefined' || typeof Element.prototype.animate !== 'function') return;
  installed = true;
  pageStill = still(document.documentElement);
  if (typeof ResizeObserver === 'function') new ResizeObserver(notePage).observe(document.body);
  // Something added or taken away, on a page with nothing to scroll: held
  // straight away, before it is drawn, in case what follows animates.
  new MutationObserver(() => {
    if (!pageStill) return;
    hold(document.documentElement);
    check();
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', () => {
    pageStill = still(document.documentElement);
  });

  const animate = Element.prototype.animate;
  Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
    const a = animate.apply(this, args);
    const end = a.effect?.getComputedTiming().endTime;
    if (typeof end === 'number' && Number.isFinite(end) && end > 0) {
      hold(this);
      a.finished.then(check, check);
    }
    return a;
  };

  const start = (e: Event) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    // A CSS animation that loops for ever (a glow, a shimmer) is no reason to hold anything.
    if (e.type === 'animationstart' && getComputedStyle(t).animationIterationCount.includes('infinite')) return;
    hold(t);
    check();
  };
  for (const type of ['animationstart', 'transitionrun']) document.addEventListener(type, start, true);
  for (const type of ['animationend', 'animationcancel', 'transitionend', 'transitioncancel']) document.addEventListener(type, check, true);
}
