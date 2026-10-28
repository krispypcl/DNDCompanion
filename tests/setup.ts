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
