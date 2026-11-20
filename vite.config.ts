import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

/** The path the site is served under: '' locally, '/DNDCompanion' on GitHub Pages. */
const basePath = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
  plugins: [
    sveltekit({
      preprocess: vitePreprocess(),
      // Static output. GitHub Pages serves 404.html for any path it has no file
      // for, so that is the SPA shell: a direct hit on /s/<uuid> lands there and
      // the router resolves it client-side. Using index.html instead gives a
      // real 404, which breaks every shared sheet link.
      adapter: adapter({ fallback: '404.html', strict: false }),
      paths: { base: basePath },
      // Every open page asks each minute whether a new version has been
      // deployed (_app/version.json); +layout reloads once it is safe to.
      version: { pollInterval: 60_000 }
    })
  ],
  // SvelteKit 3 no longer exports the base path; #lib/base reads this.
  define: { __BASE_PATH__: JSON.stringify(basePath) },
  // Read PUBLIC_* at build time without SvelteKit's $env/static/public, which
  // hard-fails a build when the variables are absent (e.g. a CI run with no secrets).
  envPrefix: ['PUBLIC_', 'VITE_']
});
