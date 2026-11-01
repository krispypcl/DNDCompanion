import '@testing-library/jest-dom/vitest';

/**
 * jsdom implements no media queries, and Svelte's motion module queries
 * prefers-reduced-motion on import. Report "no preference" so transitions
 * take their normal path in tests.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as typeof window.matchMedia;
}

/**
 * jsdom has no layout, so nothing ever resizes; Svelte's size bindings still
 * ask for an observer.
 */
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/**
 * Testing-library only registers its own auto-cleanup when vitest runs with
 * `globals: true`, which this config does not. Without it, each render leaves
 * its DOM behind and the next test in the file sees two copies of everything —
 * so unmount explicitly after every test.
 */
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

/**
 * Svelte's transitions run on the Web Animations API, which jsdom lacks. A
 * stand-in that finishes at once lets components with transitions mount and
 * unmount in tests.
 */
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function () {
    const animation = {
      onfinish: null as null | (() => void),
      oncancel: null,
      currentTime: 0,
      playState: 'finished',
      cancel() {},
      finish() {},
      play() {},
      pause() {},
      reverse() {},
      addEventListener() {},
      removeEventListener() {},
      finished: Promise.resolve()
    };
    queueMicrotask(() => animation.onfinish?.());
    return animation as unknown as Animation;
  };
}

/** jsdom has no PointerEvent; a MouseEvent with a pointer id and type stands in. */
if (typeof window !== 'undefined' && !('PointerEvent' in window)) {
  class PointerEventStub extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = PointerEventStub;
}
