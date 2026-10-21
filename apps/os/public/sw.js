/**
 * MedCore OS • High-Availability Healthcare Service Worker
 * Version: 3.0.0 — Aggressive Chunk Pre-Cache for Instant Module Navigation
 * Optimized for 2G, slow 3G, spotty hospital connections, and offline clinical stations.
 *
 * Strategy summary
 * ─────────────────────────────────────────────────────────────────────────────
 *  navigate  → Cache-First (instant shell), background revalidate
 *  /_next/static/* → Pure Cache-First (content-hashed = immutable, 1-year TTL)
 *  fonts     → Cache-First, background revalidate
 *  images    → Cache-First, background revalidate
 *  API/WS    → Always bypass (never intercept)
 *
 * After install: background prefetch batches all /_next/static chunks so
 * subsequent module clicks load at near-0ms even on 2G.
 */

const CACHE_NAME = 'medcore-os-shell-v6';
const CHUNK_CACHE = 'medcore-os-chunks-v6';

// Minimal set for immediate install (small — keeps SW install fast on slow networks)
const CORE_PRECACHE = ['/', '/manifest.json'];

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        CORE_PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (res && res.status === 200) await cache.put(url, res);
          } catch {
            // non-fatal: worker still installs
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.map((name) => {
          if (name !== CACHE_NAME && name !== CHUNK_CACHE) return caches.delete(name);
        })
      )
    ).then(() => self.clients.claim())
  );

  // Background: prefetch all Next.js static chunks after activation
  // Runs AFTER claim so it does not delay initial page render at all.
  event.waitUntil(prefetchNextChunks());
});

/**
 * Discover and cache all /_next/static/ JS and CSS chunks in small batches.
 * Uses the current page HTML to extract chunk URLs (no hardcoding needed).
 * Runs silently in the background — never blocks any user-facing request.
 */
async function prefetchNextChunks() {
  try {
    const cache = await caches.open(CHUNK_CACHE);
    // Fetch the shell page to extract all script/link hrefs pointing to _next/static
    const shellRes = await fetch('/', { cache: 'no-cache' });
    if (!shellRes || shellRes.status !== 200) return;
    const html = await shellRes.text();

    // Extract /_next/static URLs from <script src>, <link href> and JSON manifests
    const urlSet = new Set();
    const scriptRe = /"?\/_next\/static\/[^\s"'<>]+\.js"?/g;
    const cssRe = /"?\/_next\/static\/[^\s"'<>]+\.css"?/g;

    for (const match of html.matchAll(scriptRe)) {
      urlSet.add(match[0].replace(/"/g, '').replace(/'/g, ''));
    }
    for (const match of html.matchAll(cssRe)) {
      urlSet.add(match[0].replace(/"/g, '').replace(/'/g, ''));
    }

    const urls = [...urlSet];

    // Process in batches of 4 to avoid saturating the network connection
    const BATCH = 4;
    for (let i = 0; i < urls.length; i += BATCH) {
      const batch = urls.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const already = await cache.match(url);
            if (already) return; // already cached, skip
            const res = await fetch(url, { cache: 'force-cache' });
            if (res && res.status === 200) await cache.put(url, res.clone());
          } catch {
            // silently skip individual chunk failures
          }
        })
      );
      // Yield between batches so we don't starve real fetch events
      await new Promise((r) => setTimeout(r, 80));
    }
  } catch {
    // Prefetch is best-effort — never surface errors
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fetchWithTimeout(request, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error(`Fetch timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    fetch(request)
      .then((res) => { clearTimeout(timer); if (!timedOut) resolve(res); })
      .catch((err) => { clearTimeout(timer); if (!timedOut) reject(err); });
  });
}

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests
  if (req.method !== 'GET') return;
  // Only handle http(s)
  if (!url.protocol.startsWith('http')) return;

  // NEVER intercept external APIs, Firestore, auth backends
  const isExternal = url.origin !== self.location.origin;
  const isGoogleFont =
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com');
  if (isExternal && !isGoogleFont) return;

  // Skip internal API routes and WebSocket upgrades
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // ── 1. Next.js static chunks (content-hashed = immutable) ─────────────────
  //    Pure cache-first: serve from cache instantly, NEVER re-fetch immutable files.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const chunkCacheStore = await caches.open(CHUNK_CACHE);
        const shellCacheStore = await caches.open(CACHE_NAME);

        const cached =
          (await chunkCacheStore.match(req)) ||
          (await shellCacheStore.match(req));
        if (cached) return cached;

        // Not cached yet: fetch and store (happens only once per file ever)
        try {
          const networkRes = await fetchWithTimeout(req, 10000);
          if (networkRes && networkRes.status === 200) {
            chunkCacheStore.put(req, networkRes.clone()).catch(() => {});
          }
          return networkRes;
        } catch {
          return new Response('', { status: 408, statusText: 'Chunk unavailable offline' });
        }
      })()
    );
    return;
  }

  // ── 2. Navigation (HTML pages) ─────────────────────────────────────────────
  //    Instant cache-first, silent background revalidation for next visit.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached =
          (await caches.match(req)) ||
          (await caches.match('/'));

        if (cached) {
          // Background refresh — does not delay response to client
          fetch(req)
            .then((networkRes) => {
              if (networkRes && networkRes.status === 200) {
                caches.open(CACHE_NAME).then((c) => c.put(req, networkRes.clone()));
              }
            })
            .catch(() => {});
          return cached;
        }

        // First visit: fetch from network
        try {
          const networkRes = await fetchWithTimeout(req, 6000);
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return networkRes;
        } catch {
          // Offline fallback station
          return new Response(
            `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MedCore OS • Hospital Low Network Station</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0B132B;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;text-align:center}
    .card{background:#1C2541;padding:36px 28px;border-radius:20px;border:1px solid #3A506B;max-width:440px;box-shadow:0 20px 40px rgba(0,0,0,.4)}
    .badge{display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(56,189,248,.15);color:#38BDF8;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;margin-bottom:16px}
    h2{margin:0 0 10px;color:#F8FAFC;font-size:20px}
    p{color:#94A3B8;font-size:13px;line-height:1.6;margin:0 0 22px}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px 20px;border-radius:12px;border:none;background:#0284C7;color:#fff;font-weight:700;font-size:14px;cursor:pointer;transition:background .2s}
    .btn:hover{background:#0369A1}
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

  // ── 3. Fonts, images, other static assets ─────────────────────────────────
  const isStaticAsset =
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|css|woff2?|ttf|otf)$/) ||
    isGoogleFont;

  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) {
          // Soft revalidation for mutable assets (fonts/images)
          fetch(req)
            .then((net) => {
              if (net && net.status === 200) {
                caches.open(CACHE_NAME).then((c) => c.put(req, net.clone()));
              }
            })
            .catch(() => {});
          return cached;
        }
        try {
          const net = await fetchWithTimeout(req, 8000);
          if (net && net.status === 200) {
            caches.open(CACHE_NAME).then((c) => c.put(req, net.clone()));
          }
          return net;
        } catch {
          const fallback = await caches.match('/favicon.ico');
          return fallback || new Response('', { status: 408 });
        }
      })()
    );
    return;
  }

  // ── 4. All other requests — network with cache fallback ───────────────────
  event.respondWith(
    fetch(req).catch(async () => {
      const match = await caches.match(req);
      if (match) return match;
      return new Response('Network unavailable', { status: 503 });
    })
  );
});

// ─── Message handler ─────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  // Allow clients to trigger a manual chunk prefetch (e.g. after first login)
  if (event.data?.type === 'PREFETCH_CHUNKS') {
    prefetchNextChunks().catch(() => {});
  }
});
