# MedCore Hospital Hub & Launch Runbook

## 1. Hub PC (on-site truth before cloud)

- **Hardware:** Desktop or mini-PC + **UPS** (not a full server rack required).
- **Install:** Node.js 20+, clone repo, run `services/api-server` on port **4000**.
- **Network:** Hospital Wi‑Fi or Ethernet; note the hub LAN IP (e.g. `192.168.1.10`).
- **Env on every OS client (Vercel / kiosk):**
  ```
  NEXT_PUBLIC_API_URL=http://192.168.1.10:4000
  ```
  Or set **LAN API URL** in Admin → Hospital Settings (realtime).

## 2. Firebase (production)

Create a dedicated Firebase project (not the demo app):

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Enable **Email/Password** Auth. Lock Firestore with facility-scoped rules.

## 3. Optional live gateways

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Card/transfer POS |
| `PAYSTACK_SECRET_KEY` | Server-only init (prefer hub, not browser) |
| `NIN_GATEWAY_URL` + `NIN_GATEWAY_KEY` | Licensed NIN aggregator |
| `NHIA_GATEWAY_URL` + `NHIA_GATEWAY_KEY` | Eligibility |
| `SMS_GATEWAY_URL` + `SMS_GATEWAY_KEY` | Patient SMS |
| `NEXT_PUBLIC_GEMINI_API_KEY` | AI copy enrichment only |

Without keys, **pilot mode** still works offline.

## 4. Day-one pilot checklist

1. Deploy OS on Vercel (latest `main`).
2. Log in as **hospital admin** → enrol reception, doctor, nurse, pharmacist, lab.
3. Reception: register patient → check-in → queue ticket print → POS.
4. Doctor/Lab: **Clinical orders bus** → place order → post result.
5. Admin Settings: download **facility backup** + **DHIS2 aggregate** + **audit CSV**.

## 5. Power cut behaviour

1. Local `localStorage` write first.  
2. Outbox queues cloud/LAN.  
3. Hub on UPS keeps LAN share.  
4. When power/network returns → flush outbox.

## 6. NDPR notes

- Minimum data for care; export/delete on request via backup + audit.  
- Prefer vNIN / consent flows when NIMC live.  
- Do not expose open “lookup any NIN” APIs.
