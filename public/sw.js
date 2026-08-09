/**
 * pastespot service worker.
 *
 * A local-only tool that cannot open without a network is a contradiction, so
 * the shell is cached and the desk opens whether or not there is one. The data
 * was never on a network to begin with.
 *
 * Hand-written rather than generated: the whole site is one document plus a
 * handful of hashed assets, which is not enough to justify a build plugin.
 */

// Both lines are rewritten at build time by the precache integration in
// astro.config.mjs. The defaults keep this file valid on its own.
const BUILD = 'dev'; // @build
const PRECACHE = ['/']; // @precache

const CACHE = `pastespot-${BUILD}`;
const SHELL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // Added one at a time on purpose: with addAll a single failed asset
        // rejects the whole install and leaves the app with no offline support
        // at all. A missing font is worth far less than a working desk.
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(url).catch(() => console.warn('pastespot: could not precache', url)),
          ),
        ),
      )
      // Take over straight away; there is no other tab state to protect.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Documents go to the network first, so a deploy lands as soon as there is
  // one, and fall back to the cached shell when there is not.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(SHELL, copy));
          return response;
        })
        .catch(async () => (await caches.match(SHELL)) ?? Response.error()),
    );
    return;
  }

  // Everything else same-origin is cache-first: the build hashes its filenames,
  // so a cached asset can never be a stale version of a different one.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
