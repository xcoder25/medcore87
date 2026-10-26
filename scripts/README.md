# Ops scripts

## Full Firebase reset (Auth + Firestore)

Destructive. Requires **local** service account env (never commit the JSON):

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
# or
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json

node scripts/full-firebase-reset.mjs
```

The script must **not** embed private keys. Use Firebase Admin with ADC or `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Vercel env for Admin APIs

```
FIREBASE_SERVICE_ACCOUNT_JSON=...
ADMIN_API_SECRET=long-random-string
```

Destructive routes (`/api/staff/delete-all-auth`, `flush-facility`, `delete-auth`) require:

- Header `x-admin-secret: <ADMIN_API_SECRET>`
- Header `Authorization: Bearer <Firebase ID token>`
