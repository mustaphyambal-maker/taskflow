// TaskFlow Service Worker
const CACHE_NAME = 'taskflow-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

// Install: save all files to the phone's cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching files for offline use');
      return cache.addAll(ASSETS);
    }).catch((err) => {
      console.error('Cache install failed:', err);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache first, then try network
self.addEventListener('fetch', (e) => {
  // Don't cache Chrome extensions or non-GET requests
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      
      return fetch(e.request).then((response) => {
        // Cache new successful responses for next time
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // If offline and no cache, show index.html
        return caches.match('./index.html');
      });
    })
  );
});
