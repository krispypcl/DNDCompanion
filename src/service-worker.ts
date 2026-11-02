/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/**
 * Lets the site be installed on a phone's home screen, and keeps the app's
 * own files on the device so it opens, and moves between pages, without
 * waiting on the network.
 *
 * Only the app's built files are kept, and they are named by their contents,
 * so a cached copy is never stale. Everything else — sheets, sign-in, other
 * sites' pictures — always goes to the network.
 */
import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `dndcompanion-${version}`;
const SHELL = [...build, ...files];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
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

  // The app's own files: from the device.
  if (SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req)));
    return;
  }

  // A page: the network, and when there is none, the app shell, which
  // finds its way to the right page itself.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const base = sw.registration.scope;
        return (
          (await caches.match(new URL('404.html', base).pathname)) ??
          (await caches.match(new URL('./', base).pathname)) ??
          Response.error()
        );
      })
    );
  }
});
