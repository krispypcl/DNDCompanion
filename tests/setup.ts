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
 * Testing-library only registers its own auto-cleanup when vitest runs with
 * `globals: true`, which this config does not. Without it, each render leaves
 * its DOM behind and the next test in the file sees two copies of everything —
 * so unmount explicitly after every test.
 */
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
