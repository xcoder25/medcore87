# Local Setup, Database Backups & Disaster Recovery Runbook

---

## 1. Local Development Setup

### Prerequisites
- **Node.js** `>= 20.x` (verified on Node `v22+`) and **npm** `>= 10.x`
- **PostgreSQL 15+** (or AWS Aurora/RDS endpoint) for persistent cloud/relational storage
- **Git**

### Initial Setup
```bash
# 1. Clone repository & install monorepo dependencies
git clone <repo-url>
cd medcore
npm install

# 2. Copy environment templates (never commit .env.local!)
cp apps/os/.env.example apps/os/.env.local
cp apps/admin/.env.example apps/admin/.env.local
# Edit both files with local PostgreSQL URL + test/sandbox keys
```

### Starting Apps Locally
- **MedCore OS (Hospital EMR — port `3003`):**
  ```bash
  npm run dev:os
  ```
- **MOH Oversight Portal (State Admin — port `3004`):**
  ```bash
  npm run dev:admin
  ```
- **Express LAN Hub (`services/api-server` — port `4000`):**
  ```bash
  npm run dev:server
  ```

### Schema Initialization
No separate migration CLI step is required for a fresh PostgreSQL database:
- On first authenticated/health request, [`ensureSchema()`](../apps/os/src/lib/db/postgres.ts) and [`ensureMohSchema()`](../apps/admin/src/lib/db/postgres.ts) idempotently execute `CREATE TABLE IF NOT EXISTS`, create indexes, enable Row-Level Security (`ENABLE ROW LEVEL SECURITY`), and create RLS policies.
- Verify database health at: `GET http://localhost:3003/api/db/health`.

### Running Tests & Type Checks
```bash
# Regenerate OpenAPI 3.1.0 & Route Handler docs
npm run docs:openapi

# Run OS invariant suite & TypeScript check
cd apps/os && npm test && npx tsc --noEmit

# Run MOH Admin invariant suite
cd ../admin && npm test
```

---

## 2. Backup Architecture

MedCore uses **three complementary backup layers**:

| Layer | Frequency / Trigger | Scope | Recovery Use Case |
|---|---|---|---|
| **1. Aurora / RDS Automated Snapshots + PITR** | Continuous WAL archiving + daily snapshot (`7–35 day` retention recommended) | All 23 OS tables + 11 MOH tables in PostgreSQL | Point-in-time recovery (PITR) after accidental deletion, corruption, or bad deployment |
| **2. Manual Logical Snapshot (`pg_dump`)** | Pre-release / weekly off-cluster archive | Full `public` schema + RLS policies (`pg_dump --format=custom`) | Air-gapped / sovereign on-prem archive or cross-region migration |
| **3. S3 Versioning + Facility JSON Export** | Real-time S3 object versioning; on-demand JSON download via [`backupService.ts`](../apps/os/src/lib/backupService.ts) | Uploaded clinical/avatar media in S3 + active facility emergency offline snapshot (`medcore-backup-<facilityId>-<YYYY-MM-DD>.json`) | Accidental file deletion, pilot workstation emergency export |

> **Critical Reminder:** Always ensure **S3 Bucket Versioning** and **MFA Delete / Object Lock (where policy requires)** are enabled on the production `MEDCORE_S3_BUCKET`, and retain encrypted backups in a separate AWS region (`cross-region snapshot copy`).

---

## 3. Disaster Recovery (DR) Runbook

### Target Recovery Objectives
- **RPO (Recovery Point Objective):** `<= 5 minutes` (via RDS/Aurora continuous transaction log / PITR)
- **RTO (Recovery Time Objective):** `< 30 minutes` for full cloud service restoration (plus immediate local LAN / offline fallback via IndexedDB/local facility cache for active clinics while cloud reconnects)

### Scenario A — Logical Data Corruption or Accidental Facility Deletion (PITR)
1. **Halt Mutating Traffic (if corruption ongoing):** Pause `daily-ops` cron or rotate compromised credentials in Vercel/hosting environment variables; notify clinical leads to remain on local workstation draft cache temporarily.
2. **Identify Clean Timestamp:** Check `clinical_audit_ledger` (`GET /api/audit?facilityId=...` or RDS logs) for the exact UTC timestamp immediately preceding the incident.
3. **Restore RDS Instance/Cluster to Point in Time:**
   - AWS Console → RDS → Databases → Select primary instance → **Actions → Restore to point in time**.
   - Launch restored instance (`medcore-pg-restore-YYYYMMDD`) inside the same VPC/security group with KMS encryption enabled.
   - Verify the IAM OIDC database role policy (`AWS_ROLE_ARN` / RDS IAM Auth) allows connection to the restored resource ARN.
4. **Cut Over Application Env:**
   - Update `MEDCORE_AWS_DB_PGHOST` (or `DATABASE_URL`) in Vercel / deployment settings for **both** `apps/os` and `apps/admin` to point to the restored endpoint, then trigger a redeploy/restart.
5. **Post-Restore Verification Checklist:**
   - [ ] `GET /api/db/health` returns `{ ok: true, connected: true }`.
   - [ ] Confirm RLS policies are active on all 22 tables (`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`).
   - [ ] Spot-check key facility row counts (`patients`, `clinical_orders`, `invoices_receipts`, `clinical_audit_ledger`).
   - [ ] Verify tamper-evident chain integrity (`verifyAuditChain` / `POST /api/audit/anchor` dry run).
   - [ ] Resume clinical operations and confirm staff can log in + sync queued offline drafts.

### Scenario B — Manual Off-Cluster Restore via `pg_dump` / `pg_restore`
```bash
# Encrypted custom-format backup (run against replica or during maintenance)
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges -f "medcore_$(date +%Y%m%d_%H%M).dump"

# Restore into clean target PostgreSQL instance
pg_restore --dbname="$TARGET_DATABASE_URL" --clean --if-exists --no-owner --no-privileges medcore_backup.dump

# Re-run application health check to ensure ensureSchema() / RLS policies match current app version
curl -fsS https://your-domain/api/db/health
```

### Scenario C — S3 Media Recovery
- If objects were overwritten or deleted in `MEDCORE_S3_BUCKET`, list noncurrent object versions via `aws s3api list-object-versions --bucket "$MEDCORE_S3_BUCKET" --prefix "<facilityId>/"` and restore the last clean version by removing the delete marker.

### Quarterly DR Drill Schedule
- Test PITR restore into an isolated staging DB once per quarter, run `apps/os/tests/run-invariants.mjs` + `/api/db/health`, and record completion time (RTO), tested timestamp (RPO), and auditor sign-off in `clinical_audit_ledger`.
