const CACHE_NAME = 'vitverse-v1'; // You can bump this if needed, but the logic below handles it
const ASSETS = [
  './',
  './index.html',
  './breathewell.html',
  './chronozen.html',
  './style.css',
  './companion.css',
  './breathewell.css',
  './companion.js',
  './companion-ui.js',
  './juice.js',
  './ai-logger.js'
];

// Install: Cache the assets and immediately activate
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate: Delete old caches and take control of open pages
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-First strategy
self.addEventListener('fetch', (e) => {
  // Only handle GET requests
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If network request is successful, clone it and update the cache
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails (offline), serve from cache
        return caches.match(e.request);
      })
  );
});
