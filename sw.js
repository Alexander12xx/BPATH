/* BrightPath offline cache.
   Network-first so a fresh upload is seen immediately, with the cached copy as a
   fallback when the phone is offline. API requests are never cached. */
const CACHE_NAME = 'brightpath-v13';
const APP_SHELL = [
  './',
  './index.html',
  './app.html',
  './styles.css',
  './download.css',
  './download.js',
  './app.js',
  './manifest.json',
  './icon.svg',
  './site-config.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
  )));
  self.clients.claim();
});

function cacheResponse(request, response) {
  if (!response || !response.ok || response.type !== 'basic') return response;
  const copy = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') !== -1) return;
  /* Never store the Android package in the offline cache. */
  if (url.pathname.indexOf('/downloads/') !== -1 || /\.apk$/i.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => cacheResponse(request, response))
        .catch(() => caches.match(request).then(cached => cached || caches.match('./app.html')))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => cacheResponse(request, response))
      .catch(() => caches.match(request))
  );
});
