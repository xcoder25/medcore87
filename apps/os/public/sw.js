/**
 * MedCore OS • High-Availability Healthcare Service Worker
 * Version: 1.0.0
 * Provides offline shell caching, background sync resilience, and instant PWA installability.
 */

const CACHE_NAME = 'medcore-os-shell-v2';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/manifest.webmanifest',
  '/medcore-logo.png',
  '/favicon.ico',
  '/favicon.png',
  '/auth-hero.png',
  '/hosos-clean.png',
];

// Install Event — precache core UI shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch((err) => {
        console.warn('[MedCore SW] Pre-caching warning:', err);
      })
  );
});

// Activate Event — cleanup outdated caches & claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch Event — Network-first for dynamic navigation, Stale-while-revalidate for static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests (e.g. POST to API/Firestore)
  if (req.method !== 'GET') return;

  // Ignore chrome-extension or third-party tracking
  if (!url.protocol.startsWith('http')) return;

  // 1. Navigation requests (HTML pages) -> Network-First with Cache Fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseClone));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(req);
          if (cachedResponse) return cachedResponse;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8">
                <title>MedCore OS • Offline Station</title>
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <style>
                  body { font-family: -apple-system, sans-serif; background: #0F172A; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                  .card { background: #1E293B; padding: 32px; border-radius: 20px; border: 1px solid #334155; max-width: 420px; }
                  h2 { margin: 0 0 10px; color: #38BDF8; }
                  p { color: #94A3B8; font-size: 14px; line-height: 1.6; }
                  button { margin-top: 16px; padding: 12px 20px; border-radius: 10px; border: none; background: #0284C7; color: #fff; font-weight: 700; cursor: pointer; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h2>Hospital OS Offline Mode</h2>
                  <p>Network connectivity interrupted. Local patient cache and offline clinical queues remain operational.</p>
                  <button onclick="window.location.reload()">Reconnect Station</button>
                </div>
              </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // 2. Static assets (images, fonts, stylesheets, scripts) -> Stale-While-Revalidate
  const isStatic =
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|css|js|woff2?|ttf|otf)$/) ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. All other requests -> Network with fallback to cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

// Broadcast listener from client tabs
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
