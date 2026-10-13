/* Ember service worker: offline shell + runtime caching (fonts included). */
const CACHE = 'ember-shell-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'api.fontshare.com', 'cdn.fontshare.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['./']).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The page asks us to cache its own URL (whatever the HTML file is called).
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil(caches.open(CACHE).then((c) => Promise.all(data.urls.map((u) => c.add(u).catch(() => {})))));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
//  NEW FIXED CODE (Replace with this)
if (FONT_HOSTS.includes(url.hostname)) {
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // 1. Check the backpack (cache) first
      const hit = await cache.match(req);
      
      // 2. Start fetching from the internet in the background
      const fresh = fetch(req)
        .then((res) => { 
          // Only save it to the cache if the download was successful
          if (res.status === 200) {
            cache.put(req, res.clone()); 
          }
          return res; 
        })
        .catch(() => hit); // If internet fails entirely, use what we have

      // 3. FIX: We use 'await' so the browser actually waits for the internet file if the cache is empty!
      return hit || await fresh;
    })
  );
  return;
    }
  

  if (url.origin !== self.location.origin) return;

  // Pages: network first (picks up updates), fall back to cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('./')))
    );
    return;
  }

  // Everything else on this origin: cache first, then network.
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }))
  );
});
