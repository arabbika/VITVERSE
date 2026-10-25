const CACHE_NAME = 'vitverse-v100'; // FORCED CACHE CLEAR
const ASSETS = [
  './', './index.html', './breathewell.html', './chronozen.html', './dreamweaver.html', './soulsync.html', './zen.html',
  './style.css', './companion.css', './breathewell.css',
  './companion.js', './companion-ui.js', './juice.js', './ai-logger.js', './audio.js', './cloud.js', './zen.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
