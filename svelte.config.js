import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Static output. GitHub Pages serves 404.html for any path it has no file
    // for, so that is the SPA shell: a direct hit on /s/<uuid> lands there and
    // the router resolves it client-side. Using index.html instead gives a
    // real 404, which breaks every shared sheet link.
    adapter: adapter({ fallback: '404.html', strict: false }),
    paths: { base: process.env.BASE_PATH ?? '' }
  }
};
