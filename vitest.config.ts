import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Tests use the plain Svelte plugin rather than sveltekit(): the Kit plugin
 * expects a dev/build server and its preprocessor fails under vitest.
 */
export default defineConfig({
  plugins: [svelte({ configFile: false })],
  resolve: {
    conditions: ['browser'],
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts']
  }
});
