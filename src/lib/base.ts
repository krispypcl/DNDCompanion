/**
 * The path the site is served under: '' locally, '/DNDCompanion' on GitHub
 * Pages. It is the same BASE_PATH value SvelteKit's `paths.base` gets, set in
 * vite.config.ts. SvelteKit 3 no longer exports it, and share links, Owlbear
 * and sign-in need it whole to build full addresses.
 */
export const base: string = __BASE_PATH__;
