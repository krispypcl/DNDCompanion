import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Static output. `fallback` makes dynamic routes like /s/[id] work on
    // a plain file host: unknown paths serve the SPA shell and the router
    // resolves them client-side.
    adapter: adapter({ fallback: 'index.html', strict: false }),
    paths: { base: process.env.BASE_PATH ?? '' }
  }
};
