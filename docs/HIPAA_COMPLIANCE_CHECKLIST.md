# MedCore OS — HIPAA Technical & Administrative Compliance Checklist

## 1. Technical Safeguards (§164.312) — Implemented in Code
- **Access Control & Unique User IDs (§164.312(a)(1))**:
  - Signed HttpOnly `medcore_session_token` cookies (`apps/os/src/lib/serverSession.ts`) verified on every protected `/api/*` request via `apps/os/src/middleware.ts` (`401 Unauthorized` / `403 Forbidden`).
  - Role-Based Access Control (RBAC) clearance gating (`clearanceLevel >= 4` for privileged admin/staff-destruction endpoints).
  - Multi-tenant isolation enforced in both Edge middleware and PostgreSQL Row-Level Security (`facility_isolation_policy` in `apps/os/src/lib/db/postgres.ts`).
- **Automatic Logoff (§164.312(a)(2)(iii))**:
  - `InactivityLockGuard` (`apps/os/src/components/auth/InactivityLockGuard.tsx`) monitors workstation idle time (default **15 minutes**, configurable 5–60 min in Hospital Settings), displays a 60-second warning, scrubs local PHI caches, and ends the server session.
- **Browser PHI Scrubbing on Sign-Out**:
  - `scrubPhiOnLogout` (`apps/os/src/lib/hipaaPrivacy.ts`) removes all PHI keys from `localStorage` and `sessionStorage` and clears the HttpOnly session cookie on logout or timeout.
  - Active patient chart context (`apps/os/src/lib/patientContextStore.ts`) is stored strictly in `sessionStorage` (never persistent `localStorage`).
- **Audit Controls (§164.312(b))**:
  - Tamper-evident SHA-256 hash-chained `clinical_audit_ledger` (`computeAuditRowHash` in `apps/os/src/lib/db/postgres.ts`).
- **Transmission & Transport Security (§164.312(e)(1))**:
  - HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and sliding-window brute-force rate limiting (`apps/os/src/lib/rateLimit.ts`).
- **Minimum Necessary Partitioning**:
  - `notificationEngine.ts` and `InBasketPanel.tsx` partition clinical NEWS2 / lab panic alerts away from Reception and Accounts desks.

## 2. Administrative & Production Cutover Checklist (Required Before Live PHI)
- [ ] **Enable Staff 2FA**: Toggle **Require Two-Factor Authentication (2FA / Email OTP)** ON in **Hospital Settings & Facility Setup → Data & Security**, and configure `RESEND_API_KEY` + `MEDCORE_EMAIL_FROM` (or `EMAIL_WEBHOOK_URL`).
- [ ] **Set Strong Secrets**: Configure a 32+ byte random `MEDCORE_SESSION_SECRET` in Vercel Environment Variables.
- [ ] **Execute Business Associate Agreements (BAAs)**: Sign BAAs with your PostgreSQL/AWS host, Vercel (Enterprise/HIPAA plan), Firebase/Google Cloud, and Email delivery vendor.
- [ ] **Staff Training & Attestation**: Complete annual HIPAA privacy training for hospital staff and toggle **BAA & HIPAA Staff Training Attestation Signed** in Hospital Settings.
