const CACHE_NAME = 'vitverse-v2'; // Change from v1 to v2;
const ASSETS = [
  './',
  './index.html',
  './breathewell.html',
  './chronozen.html',
  './style.css',
  './breathewell.css',
  './companion.css',
  './companion.js',
  './companion-ui.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
