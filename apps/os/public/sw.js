/**
 * MedCore OS • High-Availability Healthcare Service Worker
 * Version: 2.0.0 (Low-Bandwidth & Resilient Offline Architecture)
 * Optimized for 2G, slow 3G, spotty hospital connections, and offline clinical stations.
 */

const CACHE_NAME = 'medcore-os-shell-v5-instant';

// Only lightweight, essential shell files are precached at install time.
// Multi-megabyte images are NOT placed here so that slow networks (2G/3G)
// install the Service Worker in under 1 second without timing out.
const CORE_PRECACHE = [
  '/',
  '/manifest.json',
  '/manifest.webmanifest',
];

// Install Event — precache core UI shell safely without blocking on slow networks
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Fetch each core asset individually so that if one fails, the worker still installs!
      await Promise.allSettled(
        CORE_PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (res && res.status === 200) {
              await cache.put(url, res);
            }
          } catch (e) {
            console.warn('[MedCore SW] Optional precache skipped for:', url, e);
          }
        })
      );
    })
  );
  self.skipWaiting();
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

// Helper: Fetch with timeout
function fetchWithTimeout(request, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error(`Fetch timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fetch(request)
      .then((res) => {
        clearTimeout(timer);
        if (!timedOut) resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        if (!timedOut) reject(err);
      });
  });
}

// Fetch Event
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests (e.g. POST to API/Firestore)
  if (req.method !== 'GET') return;

  // Ignore non-http protocols (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // CRITICAL: NEVER intercept external APIs, Firestore, or backend endpoints!
  const isExternal = url.origin !== self.location.origin;
  const isGoogleFont =
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');

  if (isExternal && !isGoogleFont) {
    return;
  }

  // Also skip internal API routes and realtime websockets
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    return;
  }

  // 1. Navigation requests (HTML pages) -> Instant Stale-While-Revalidate (0ms Cache-First)
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cachedResponse = (await caches.match(req)) || (await caches.match('/'));

        // If cached shell is available, serve it INSTANTLY with 0ms network latency
        if (cachedResponse) {
          // Revalidate in the background silently without blocking initial render
          fetch(req)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // First time visit and not cached yet: attempt network fetch with fallback
        try {
          const networkResponse = await fetchWithTimeout(req, 6000);
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            return networkResponse;
          }
          return networkResponse;
        } catch {
          // Return built-in lightweight offline station UI
          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8">
                <title>MedCore OS • Hospital Low Network Station</title>
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0B132B; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                  .card { background: #1C2541; padding: 36px 28px; border-radius: 20px; border: 1px solid #3A506B; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
                  .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(56, 189, 248, 0.15); color: #38BDF8; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 16px; }
                  h2 { margin: 0 0 10px; color: #F8FAFC; font-size: 20px; }
                  p { color: #94A3B8; font-size: 13px; line-height: 1.6; margin: 0 0 22px; }
                  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 13px 20px; border-radius: 12px; border: none; background: #0284C7; color: #fff; font-weight: 700; font-size: 14px; cursor: pointer; transition: background 0.2s; }
                  .btn:hover { background: #0369A1; }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="badge">Low Bandwidth / Offline Station</div>
                  <h2>Hospital OS Network Interruption</h2>
                  <p>MedCore OS is waiting for a stable connection. Once loaded, the clinical shell remains accessible offline even during total network blackouts.</p>
                  <button class="btn" onclick="window.location.reload()">Retry Connection Now</button>
                </div>
              </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      })()
    );
    return;
  }

  // 2. Next.js chunks, scripts, styles, fonts, and images
  const isStatic =
    url.pathname.includes('/_next/static/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|css|js|woff2?|ttf|otf)$/) ||
    isGoogleFont;

  if (isStatic) {
    event.respondWith(
      caches.match(req).then((cached) => {
        // Cache-First for content-hashed immutable Next.js static files and cached assets
        if (cached) {
          // Revalidate in background without blocking rendering
          fetch(req)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
              }
            })
            .catch(() => {});
          return cached;
        }

        // Not in cache: fetch from network and store for future low-network visits
        return fetch(req)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return networkResponse;
          })
          .catch(async () => {
            const fallback = await caches.match('/favicon.ico');
            return fallback || new Response('', { status: 408, statusText: 'Request Timeout' });
          });
      })
    );
    return;
  }

  // 3. Fallback for any other request
  event.respondWith(
    fetch(req).catch(async () => {
      const match = await caches.match(req);
      if (match) return match;
      return new Response('Network unavailable', { status: 503, statusText: 'Service Unavailable' });
    })
  );
});

// Broadcast listener from client tabs
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
