import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  // Read PUBLIC_* at build time without SvelteKit's $env/static/public, which
  // hard-fails a build when the variables are absent (e.g. a CI run with no secrets).
  envPrefix: ['PUBLIC_', 'VITE_'],
});
