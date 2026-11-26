# MedCore Platform Documentation

Lightweight, codebase-coupled documentation for engineers, security auditors, and hospital administrators.

## Core Compliance & Engineering References

| Area | Document | Source of Truth |
|---|---|---|
| **1. API & Server Actions** | [API & Server Actions Reference](api/API_AND_SERVER_ACTIONS.md) · [OpenAPI 3.1.0 Spec](api/openapi.json) | Auto-generated via `npm run docs:openapi` ([`scripts/generate-openapi.mjs`](../scripts/generate-openapi.mjs)) |
| **2. Database ERD & Workflows** | [Database Schema, ERD & Clinical Workflow State Rules](DATABASE_AND_WORKFLOWS.md) | [`apps/os/src/lib/db/postgres.ts`](../apps/os/src/lib/db/postgres.ts) · [`apps/admin/src/lib/db/postgres.ts`](../apps/admin/src/lib/db/postgres.ts) |
| **3. Security, RBAC & Audit Logs** | [Security, RBAC Matrix, PHI Protection & Audit Trail](SECURITY_RBAC_AUDIT.md) | [`middleware.ts`](../apps/os/src/middleware.ts) · [`rolePermissionsStore.ts`](../apps/os/src/lib/rolePermissionsStore.ts) · [`auditLogStore.ts`](../apps/os/src/lib/auditLogStore.ts) |
| **4. Setup & Disaster Recovery** | [Local Setup, Backups & DR Runbook](SETUP_AND_RECOVERY.md) · Root [`.env.example`](../.env.example) · OS [`.env.example`](../apps/os/.env.example) · Admin [`.env.example`](../apps/admin/.env.example) | [`backupService.ts`](../apps/os/src/lib/backupService.ts) · `vercel.json` |

## Additional Existing Manuals & Guides
- **Architecture & Compliance Deep Dives:** [ARCHITECTURE.md](ARCHITECTURE.md) · [SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md) · [MOH_ADMIN_ARCHITECTURE.md](architecture/MOH_ADMIN_ARCHITECTURE.md) · [NDHA_COMPLIANCE.md](architecture/NDHA_COMPLIANCE.md) · [HIPAA_GDPR_COMPLIANCE.md](security/HIPAA_GDPR_COMPLIANCE.md) · [HIPAA_COMPLIANCE_CHECKLIST.md](HIPAA_COMPLIANCE_CHECKLIST.md)
- **Express LAN Hub API:** [API_REFERENCE.md](API_REFERENCE.md)
- **Deployment & Operations:** [DEPLOYMENT.md](DEPLOYMENT.md) · [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md) · [HUB_AND_LAUNCH.md](HUB_AND_LAUNCH.md) · [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
- **User & QA Guides:** [MEDCORE_NOVICE_USER_MANUAL.md](MEDCORE_NOVICE_USER_MANUAL.md) · [TESTER_MANUAL.md](TESTER_MANUAL.md)
