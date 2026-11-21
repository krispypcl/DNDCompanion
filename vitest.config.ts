import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

/**
 * Tests use the plain Svelte plugin rather than sveltekit(): the Kit plugin
 * expects a dev/build server and its preprocessor fails under vitest.
 * `#lib/*` resolves through package.json `imports`.
 */
export default defineConfig({
  plugins: [svelte({ configFile: false })],
  // Tests serve the app from the site root (see #lib/base).
  define: { __BASE_PATH__: JSON.stringify(''), __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: {
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts']
  }
});
