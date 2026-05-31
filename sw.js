const CACHE = 'biswas-fisheries-v3';
const CORE = ['./index.html', './', './manifest.json', './icon-192.png', './icon-512.png', './sw.js'];

// Install: cache all core files
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(CORE.map(url => 
        c.add(url).catch(err => console.log('Cache miss:', url, err))
      ));
    })
  );
});

// Activate: clear old caches immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache first for app shell, network only for API
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // API calls — network only, never cache
  if (url.includes('script.google.com')) {
    e.respondWith(
      fetch(e.request).catch(() => 
        new Response(JSON.stringify({status:'offline'}), {
          headers: {'Content-Type': 'application/json'}
        })
      )
    );
    return;
  }

  // App shell — cache first, fallback to network, then index.html
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Return cached, but update cache in background
        fetch(e.request).then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      // Not in cache — try network
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
