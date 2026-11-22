/**
 * Lets the site be installed on a phone's home screen, and keeps the app's
 * own files on the device so it opens, and moves between pages, without
 * waiting on the network.
 *
 * Only the app's built files are kept, and they are named by their contents,
 * so a cached copy is never stale. Everything else — sheets, sign-in, other
 * sites' pictures — always goes to the network.
 *
 * Light to install: only what every visit starts with is fetched up front.
 * The rest (shared pieces, and the heavy ones a visit may never need, like
 * the PDF maker and the search index) is kept the first time it is used.
 */
import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';

const CACHE = `dndcompanion-${version}`;
// The manifest's paths are relative to the base path, and the worker's scope
// is the base path, so each resolves against the scope.
const scoped = (path: string) => new URL(path, sw.registration.scope).pathname;
/** Everything built: served from the device once kept. */
const BUILT = new Set([...immutable, ...assets].map(({ path }) => scoped(path)));
/**
 * What is fetched at install: the entry, the pages' own code, styles and
 * icons. Not the PDF's fonts, the Owlbear tokens, the email picture, or the
 * link preview, which wait until they are used.
 */
const UP_FRONT = [
  ...[...immutable].map(({ path }) => path).filter((p) => /(^|\/)(entry|nodes)\//.test(p) || /\.css$/.test(p)),
  ...[...assets].map(({ path }) => path).filter((p) => !/^(pdf|owlbear|email)\/|^og\.png$/.test(p))
].map(scoped);
const SHELL_PAGE = scoped('404.html');

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // The shell is kept as well, for opening a page offline; never fatal.
      .then((cache) => cache.addAll(UP_FRONT).then(() => cache.add(SHELL_PAGE).catch(() => {})))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== sw.location.origin) return;

  // The app's version, asked to find out whether a new one was deployed: always
  // from the network, past the browser's own cache too. SvelteKit only asks
  // with a header, which Safari may answer from a copy up to ten minutes old.
  if (url.pathname.endsWith('/_app/version.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // The app's own files: from the device, or kept the first time they are fetched.
  if (BUILT.has(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              void caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // A page: the network, and when there is none, the app shell, which
  // finds its way to the right page itself.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const base = sw.registration.scope;
        return (
          (await caches.match(SHELL_PAGE)) ??
          (await caches.match(new URL('./', base).pathname)) ??
          Response.error()
        );
      })
    );
  }
});
