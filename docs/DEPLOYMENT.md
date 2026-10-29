# MedCore OS — Deployment & DevOps Guide
**Version 2.0 · October 2026**

---

## 1. Deployment Targets

MedCore OS supports four deployment modes depending on hospital infrastructure:

| Mode | Description | Best For |
|------|-------------|---------|
| **Local LAN** | Node.js dev server on hospital intranet | Pilot hospitals, UAT |
| **Docker** | Containerized on hospital server / VM | On-premise production |
| **Railway / Fly.io** | Cloud PaaS (managed containers) | State-level cloud deployment |
| **Firebase Hosting** | Static Next.js export + Firebase Functions | Low-maintenance cloud |

---

## 2. Local LAN Deployment (Recommended for Pilot)

### Requirements
- Windows Server 2019+ or Ubuntu 20.04+ server
- Node.js v18+
- 4 GB RAM minimum (8 GB recommended)
- LAN with DHCP (all clinical workstations on same subnet)

### Steps
```bash
# 1. Clone repository on the server
git clone https://github.com/your-org/medcore.git
cd medcore

# 2. Install dependencies
npm install

# 3. Build the OS app for production
cd apps/os
npm run build

# 4. Start the API server (keep running permanently)
cd ../../services/api-server
npm install
npm run start   # production start

# 5. Start the OS app (keep running permanently)
cd ../apps/os
npm run start -- -p 3003

# App is now accessible at http://<server-ip>:3003 from all LAN workstations
```

### Run as Windows Service (using PM2)
```bash
npm install -g pm2

# Start both services
pm2 start "npm run start" --name medcore-api --cwd services/api-server
pm2 start "npm run start -- -p 3003" --name medcore-os --cwd apps/os

# Save to auto-start on reboot
pm2 save
pm2 startup
```

### Firewall Rules (Windows)
```powershell
netsh advfirewall firewall add rule name="MedCore OS" dir=in action=allow protocol=TCP localport=3003
netsh advfirewall firewall add rule name="MedCore API" dir=in action=allow protocol=TCP localport=4000
```

---

## 3. Docker Deployment

### Build image
```bash
cd medcore
docker build -t medcore-os:2.0 .
```

### Run containers
```bash
# API server
docker run -d \
  --name medcore-api \
  -p 4000:4000 \
  -e DATABASE_URL=postgresql://user:pass@db:5432/medcore \
  -e GEMINI_API_KEY=your-key \
  medcore-os:2.0 node services/api-server/dist/index.js

# OS application
docker run -d \
  --name medcore-os \
  -p 3003:3003 \
  -e NEXT_PUBLIC_WS_URL=ws://medcore-api:4000/ws \
  medcore-os:2.0 node apps/os/.next/standalone/server.js
```

### Docker Compose (recommended)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: medcore
      POSTGRES_USER: medcore
      POSTGRES_PASSWORD: secure-password-here
    volumes:
      - postgres-data:/var/lib/postgresql/data

  api:
    image: medcore-os:2.0
    command: node services/api-server/dist/index.js
    ports: ["4000:4000"]
    environment:
      DATABASE_URL: postgresql://medcore:secure-password-here@postgres:5432/medcore
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      TERMII_API_KEY: ${TERMII_API_KEY}
      DHIS2_BASE_URL: ${DHIS2_BASE_URL}
    depends_on: [postgres]

  os:
    image: medcore-os:2.0
    command: node apps/os/.next/standalone/server.js
    ports: ["3003:3003"]
    environment:
      NEXT_PUBLIC_WS_URL: ws://api:4000/ws
      PORT: 3003
    depends_on: [api]

volumes:
  postgres-data:
```

```bash
docker compose up -d
```

---

## 4. Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Deploy (uses railway.toml)
railway up
```

**`railway.toml` (already in repo):**
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "cd apps/os && npm run start"
healthcheckPath = "/api/health"
```

Set environment variables in Railway dashboard:
- `NEXT_PUBLIC_WS_URL`
- `DATABASE_URL` (Railway PostgreSQL plugin)
- `GEMINI_API_KEY`

---

## 5. Fly.io Deployment

```bash
flyctl auth login
flyctl deploy   # uses fly.toml in repo root
```

**`fly.toml` (already in repo):**
```toml
app = "medcore-os"
primary_region = "jnb"  # Johannesburg (closest to Nigeria)

[http_service]
  internal_port = 3003
  force_https = true

[[vm]]
  memory = "2gb"
  cpu_kind = "shared"
  cpus = 2
```

---

## 6. Environment Variables Reference

| Variable | Required | Description |
|---------|---------|-------------|
| `NEXT_PUBLIC_WS_URL` | ✅ | WebSocket URL e.g. `ws://localhost:4000/ws` |
| `DATABASE_URL` | ⚡ Recommended | PostgreSQL connection string for persistence |
| `GEMINI_API_KEY` | ⚡ For AI features | Google Gemini API key (Clinical Google, Celestia) |
| `PAYSTACK_SECRET_KEY` | ⚡ For payments | Paystack live secret key |
| `PAYSTACK_PUBLIC_KEY` | ⚡ For payments | Paystack public key |
| `TERMII_API_KEY` | ⚡ For SMS | Termii Africa SMS API key |
| `DHIS2_BASE_URL` | ⚡ For NHMIS | DHIS2 instance URL |
| `DHIS2_USERNAME` | ⚡ For NHMIS | DHIS2 service account username |
| `DHIS2_PASSWORD` | ⚡ For NHMIS | DHIS2 service account password |
| `ORTHANC_URL` | Optional | Orthanc PACS server URL for real DICOM |
| `FIREBASE_PROJECT_ID` | Optional | Firebase project (if using Firebase backend) |
| `PORT` | Optional | API server port (default: 4000) |
| `NEXT_PUBLIC_APP_PORT` | Optional | OS app port (default: 3003) |

---

## 7. Database Setup (PostgreSQL)

```bash
# Create database
createdb medcore

# Run migrations (when Prisma is configured)
cd services/api-server
npx prisma migrate deploy

# Seed demo data
npx prisma db seed
```

> Without `DATABASE_URL`, the platform operates in **in-memory mode** — all data is lost on restart.
> This is acceptable for demos but not for production.

---

## 8. SSL / HTTPS (Production)

### Using Nginx reverse proxy
```nginx
server {
    listen 443 ssl;
    server_name medcore.hospital.gov.ng;

    ssl_certificate     /etc/letsencrypt/live/medcore.hospital.gov.ng/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/medcore.hospital.gov.ng/privkey.pem;

    location / {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

```bash
# Let's Encrypt certificate
certbot --nginx -d medcore.hospital.gov.ng
```

---

## 9. Backup & Disaster Recovery

### Nightly database backup
```bash
# Add to crontab (crontab -e)
0 2 * * * pg_dump medcore > /backups/medcore-$(date +%Y%m%d).sql
```

### Application backup
```bash
# Backup data directory
0 3 * * * tar -czf /backups/medcore-app-$(date +%Y%m%d).tar.gz /opt/medcore
```

### Sneakernet USB (offline backup)
Clinical staff can use the **Offline Sync & Clinical Verification** module to export encrypted patient data to USB for manual transport to facilities without internet.

---

## 10. Monitoring & Health Checks

| Endpoint | Expected |
|---------|---------|
| `GET http://localhost:4000/` | `{"status":"ok"}` |
| `GET http://localhost:3003/api/health` | `{"status":"ok"}` |

### PM2 Monitoring
```bash
pm2 status          # check process status
pm2 logs medcore-os # view application logs
pm2 monit           # real-time resource monitor
```

---

## 11. Go-Live Checklist

- [ ] API server running and WebSocket reachable (`ws://server:4000/ws`)
- [ ] OS app running at `http://server-ip:3003` from all workstations
- [ ] LIVE badge shows green in top bar
- [ ] All demo login accounts work (see TESTER_MANUAL.md §2)
- [ ] Facility profile configured (Hospital Onboarding Wizard completed)
- [ ] Database persistence configured (PostgreSQL recommended)
- [ ] SSL certificate installed for HTTPS
- [ ] PM2 or equivalent process manager running (auto-restart on crash)
- [ ] Nightly backup scheduled
- [ ] ICT contact numbers filled in GO_LIVE.md §8
- [ ] Clinical Google Search tested with patient query
- [ ] Telehealth Mesh blackout test completed
- [ ] `npx tsx scratch/verify_features.ts` → 100% pass

---

*MedCore OS Deployment Guide v2.0 · October 2026 · Powered by M87*
