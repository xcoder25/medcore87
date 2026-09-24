# Deploy MedCore Hospital OS on Vercel

## What gets deployed

| App | Path | Vercel |
|-----|------|--------|
| **Hospital OS UI** | `apps/os` | Yes — this guide |
| **API + WebSocket** | `services/api-server` | **Not** ideal on Vercel serverless (long-lived WS). Host API on Railway / Render / VPS / Fly.io |

The OS will load on Vercel with **demo/local data**. **LIVE** alerts need a separate API with WebSocket.

---

## Option A — Vercel Dashboard (recommended)

1. Push latest `master` to GitHub: `https://github.com/xcoder25/medcore87`
2. [vercel.com](https://vercel.com) → **Add New Project** → Import `xcoder25/medcore87`
3. Configure:

| Setting | Value |
|---------|--------|
| **Root Directory** | `apps/os` |
| **Framework** | Next.js (auto) |
| **Build Command** | `npm run build` |
| **Install Command** | `npm install` |
| **Output** | default (Next) |

4. **Environment variables** (Project → Settings → Environment Variables):

| Name | Value | Notes |
|------|--------|--------|
| `NEXT_PUBLIC_WS_URL` | `wss://YOUR-API-HOST/ws` | Only after API is public; leave empty for UI-only |
| `NEXT_PUBLIC_API_URL` | `https://YOUR-API-HOST` | Optional |

5. Deploy → open the `*.vercel.app` URL.

---

## Option B — Vercel CLI

```bash
# From your machine (with Vercel login)
cd medcore87/apps/os
npx vercel login
npx vercel          # preview
npx vercel --prod   # production
```

When prompted, set root to `apps/os` if run from repo root:

```bash
cd medcore87
npx vercel --cwd apps/os --prod
```

---

## After deploy

1. Open the Vercel URL → splash → login with demo staff (see `GO_LIVE.md`).
2. All dashboards work in **browser demo mode**.
3. LIVE pill stays **SYNC…** until `NEXT_PUBLIC_WS_URL` points at a running API with **WSS**.

### API hosting (for realtime later)

```bash
# Example: Railway / Render / any Node host
cd services/api-server
# Set PORT, enable WebSocket path /ws
npm run dev   # or start after build
```

Then in Vercel env:

```
NEXT_PUBLIC_WS_URL=wss://medcore-api.up.railway.app/ws
NEXT_PUBLIC_API_URL=https://medcore-api.up.railway.app
```

Redeploy OS so the client picks up env.

---

## CORS

API already uses `cors({ origin: '*' })`. For production, restrict to your Vercel domain.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on lucide/types | Ensure Root Directory is `apps/os` only |
| Blank page | Check browser console; fonts need network |
| LIVE never green | API not reachable / used `ws://` on HTTPS page → use `wss://` |
| Module not found | Deploy from latest `master` |

---

*MedCore OS · apps/os · Next.js 15*
