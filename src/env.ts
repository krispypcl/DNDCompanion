/**
 * Environment variables SvelteKit itself reads. app.html's link-preview tags
 * use PUBLIC_SITE_URL through %sveltekit.env.PUBLIC_SITE_URL%. The app's own
 * code reads PUBLIC_* through import.meta.env (see vite.config.ts).
 */
import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
  PUBLIC_SITE_URL: {
    public: true,
    static: true,
    description: "The site's public address, set by the deploy workflow.",
    // Optional: a build without it (a CI run with no variables) still works.
    schema: (value) => (value ?? '').trim().replace(/\/+$/, '')
  }
});
