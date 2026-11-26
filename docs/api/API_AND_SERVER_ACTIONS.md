# MedCore API Route Handlers & Server Actions Reference

> **Auto-generated from source** via `npm run docs:openapi` (`scripts/generate-openapi.mjs`).
> Companion machine-readable spec: [`openapi.json`](./openapi.json) (**OpenAPI 3.1.0**).

## 1. Architecture & Authentication Summary

- **Route Handlers documented:** **73** total (**59** in `apps/os`, **14** in `apps/admin`).
- **Next.js Server Actions (`"use server"`):** **0** — MedCore OS intentionally executes all mutations through Edge-Middleware-protected `/api/*` Route Handlers rather than implicit React Server Actions, ensuring uniform HttpOnly session validation, rate limiting, facility tenant isolation, and audit logging.

### Middleware Enforcement (`apps/os/src/middleware.ts`)

- **Session Cookie Auth:** Every `/api/*` route outside `PUBLIC_API_PREFIXES` requires a valid HMAC-SHA256 signed `medcore_session_token` cookie; unauthenticated calls receive `401 UNAUTHORIZED`.
- **Tenant Isolation:** Verified requests inject `x-medcore-facility-id`, `x-medcore-staff-badge`, `x-medcore-staff-name`, `x-medcore-role-key`, and `x-medcore-clearance`. Non-superadmin callers passing a mismatched `?facilityId=` receive `403`.
- **Privileged Admin Routes (`ADMIN_ONLY_API_PREFIXES` + `DELETE /api/staff`):** Require `roleKey` in `{hospital_admin, sysadmin, medical_director}` OR `clearanceLevel >= 4` (`403 FORBIDDEN` otherwise).

**Public Prefixes (`PUBLIC_API_PREFIXES`):** `/api/auth/`, `/api/staff/lookup`, `/api/db/health`, `/api/health`, `/api/ping`, `/api/akwaremit/webhook`, `/api/paystack/webhook`, `/api/whatsapp/triage`, `/api/care/`, `/api/audit/anchor`, `/api/cron/daily-ops`

**Admin-Only Prefixes (`ADMIN_ONLY_API_PREFIXES`):** `/api/staff/create`, `/api/staff/delete-auth`, `/api/staff/delete-all-auth`, `/api/staff/flush-facility`, `/api/akwaremit/configure`

## 2. MedCore OS Route Handlers (`apps/os/src/app/api`)

| Path | Methods | Auth Requirement | Query / Body Params | Status Codes | Purpose |
|------|---------|------------------|---------------------|--------------|---------|
| `/api/ai/clinical-safety` | POST | SessionCookie (facility-isolated) | `action, facilityId, vitals, patientId, patientName, hospitalNumber` | 200, 400 | Run AI-assisted clinical safety, sepsis/NEWS2, and interaction evaluation. |
| `/api/ai/digitize-fhir` | POST | SessionCookie (facility-isolated) | `recordKind, facilityId, textFallback, imageBase64, mimeType, sourceLabel` | 200, 400, 413, 500 | Digitize scanned paper charts/labs/ultrasounds into structured HL7 FHIR R4 JSON. |
| `/api/ai/patient-brief` | POST | SessionCookie (facility-isolated) | `patient, vitals, orders, diagnosis` | 200, 400 | Generate 30-second longitudinal AI clinician handoff brief. |
| `/api/ai/scan-form` | POST | SessionCookie (facility-isolated) | `imageBase64, mimeType` | 200, 400, 413, 422, 500, 503 | OCR structured extraction for paper intake/lab forms. |
| `/api/ai/scribe` | POST | SessionCookie (facility-isolated) | `transcript, facilityId, patientId, patientLabel, vitalsSummary, patientContext` | 200, 400 | Convert clinical consultation audio/transcript into structured SOAP note. |
| `/api/ai/transcribe` | POST | SessionCookie (facility-isolated) | `audioBase64, mimeType, roleHint` | 200, 400, 413, 422, 500, 503 | Transcribe dictated clinical audio or patient voice note. |
| `/api/ai/vision-clinical` | POST | SessionCookie (facility-isolated) | `documentType, imageBase64, mimeType, textFallback, patientContext` | 200, 400, 413, 503 | Analyze clinical images/scans via server-side vision proxy. |
| `/api/akshia/claims` | GET, POST, PATCH | SessionCookie (facility-isolated) | `?facilityId, facilityId, action, periodMonth, claim, id, status` | 200, 201, 400, 404, 500 | List, draft, validate readiness, or submit AKSHIA/NHIA claims and batches. |
| `/api/akshia/eligibility` | POST | SessionCookie (facility-isolated) | `—` | 200, 502, 503 | Check patient AKSHIA/NHIA enrollee eligibility status. |
| `/api/akshia/preauth` | POST | SessionCookie (facility-isolated) | `—` | 200, 502, 503 | Request AKSHIA pre-authorization code for inpatient/specialty procedures. |
| `/api/akshia/tariff` | GET | SessionCookie (facility-isolated) | `—` | 200, 502, 503 | Retrieve AKSHIA tariff schedule items. |
| `/api/akwaremit/batch-settle` | POST | SessionCookie (facility-isolated) | `facilityId, facilityName, bankName, tsaAccountNumber, bankTellerRef, akwaRemitRrr` | 200, 400 | Accountant batch settlement of cash receipts into AkwaRemit. |
| `/api/akwaremit/configure` | POST | Admin SessionCookie (role: hospital_admin|sysadmin|medical_director or clearance >= 4) | `—` | 200, 403 | Configure facility AkwaRemit treasury credentials (Admin only). |
| `/api/akwaremit/invoice` | POST | SessionCookie (facility-isolated) | `amountNgn, patientId, patientName, facilityName, serviceCategory` | 200, 400, 503 | Generate AkwaRemit state revenue collection invoice. |
| `/api/akwaremit/status` | GET | SessionCookie (facility-isolated) | `—` | 200, 500 | Check facility AkwaRemit gateway configuration status. |
| `/api/akwaremit/test` | POST | SessionCookie (facility-isolated) | `—` | 200, 502 | Run AkwaRemit connectivity check. |
| `/api/akwaremit/verify` | GET | SessionCookie (facility-isolated) | `?arn` | 200, 400, 502, 503 | Verify AkwaRemit settlement reference. |
| `/api/akwaremit/webhook` | POST | Public Webhook (HMAC signature / verify token) | `arns, event, totalAmountNgn, expectedTotalNgn, facilityId, akwaRemitRrr` | 200, 400, 401, 422 | HMAC-SHA256 verified AkwaRemit payment webhook receiver. |
| `/api/audit` | GET, POST | SessionCookie (facility-isolated) | `?facilityId, ?limit, facilityId, id, at, actor, actorBadge, category` | 200, 400 | Read or append SHA-256 hash-chained entries to clinical_audit_ledger. |
| `/api/audit/anchor` | GET, POST | Public (no session cookie required; rate-limited / route-level token checks) | `?facilityId, ?hash, facilityId, leafHashes` | 200, 201, 401 | Compute and seal zero-PHI SHA-256 Merkle root over audit ledger rows. |
| `/api/auth/biometric` | GET, POST | Public (no session cookie required; rate-limited / route-level token checks) | `?badgeId, ?facilityId, action, badgeId, facilityId, staffName, imageBase64, stage` | 200, 400, 401, 404, 409, 429, 500, 502, 503 | Check enrollment status, enroll staff face template, or verify facial biometric match. |
| `/api/auth/biometric/liveness/results` | POST | Public (no session cookie required; rate-limited / route-level token checks) | `sessionId, livenessToken, badgeId, facilityId, staffName, mode` | 200, 400, 401, 404, 409, 429, 500, 502 | Evaluate live facial liveness session confidence and issue MFA token. |
| `/api/auth/biometric/liveness/session` | POST, GET | Public (no session cookie required; rate-limited / route-level token checks) | `?livenessToken, badgeId, facilityId, mode` | 200, 400, 401, 404, 429, 500, 502 | Create 3D live facial liveness challenge session. |
| `/api/auth/facility-status` | GET | Public (no session cookie required; rate-limited / route-level token checks) | `?facilityId` | 200, 400, 500 | Return facility onboarding and authentication readiness. |
| `/api/auth/mfa` | POST | Public (no session cookie required; rate-limited / route-level token checks) | `action, facilityId, badgeId, staffName, email, expiryMinutes` | 200, 400, 401, 404, 429 | Send or verify staff Email OTP 2FA challenge. |
| `/api/auth/register-facility-admin` | POST | Public (no session cookie required; rate-limited / route-level token checks) | `facilityId, badgeId, fullName, email, pin, facilityName` | 200, 400, 409, 500, 503 | Bootstrap initial facility administrator account. |
| `/api/auth/reset-pin` | POST | Public (no session cookie required; rate-limited / route-level token checks) | `action, facilityId, query, badgeId, email, newPin` | 200, 400, 401, 404, 429, 500, 503 | Reset forgotten staff PIN after verified identity check. |
| `/api/auth/session` | GET, POST, DELETE | Public (no session cookie required; rate-limited / route-level token checks) | `badgeId, id, name, roleKey, role, facilityId` | 200, 400, 429 | Verify, issue (HMAC-SHA256 HttpOnly cookie), or clear staff session token. |
| `/api/auth/verify-pin` | POST | Public (no session cookie required; rate-limited / route-level token checks) | `facilityId, badgeId, email, pin` | 200, 400, 429, 500, 503 | Authenticate staff badge ID + PIN and issue signed session cookie. |
| `/api/care/reminders` | GET, POST | Public (no session cookie required; rate-limited / route-level token checks) | `?facilityId, facilityId, patients, reminderIds` | 200, 500 | List or dispatch antenatal, chronic care, and immunization reminders. |
| `/api/care/sync` | OPTIONS, GET, POST | Public (no session cookie required; rate-limited / route-level token checks) | `?shid, ?phone, ?facilityId, action, fullName, patientName, phone, email, facilityId` | 200 | Sync Care patient mobile bookings and SHID/AKSHIA status. |
| `/api/cron/daily-ops` | GET, POST | CronBearer (CRON_SECRET) OR Admin SessionCookie | `—` | 200, 401 | Automated daily operations cron (reminders, expiry alerts, Merkle seal). Verified via CRON_SECRET or admin session. |
| `/api/db/health` | GET | Public (no session cookie required; rate-limited / route-level token checks) | `—` | 200, 500 | PostgreSQL connectivity, auth mode, and schema readiness check. |
| `/api/dhis2/submit` | POST | SessionCookie (facility-isolated) | `—` | 200, 502, 503 | Export and submit facility DHIS2 aggregate monthly/IDSR report. |
| `/api/drafts` | GET, PUT, POST, DELETE | SessionCookie (facility-isolated) | `?facilityId, ?formType, ?draftId, facilityId, formType, draftId, staffBadge, step, payload` | 200, 400 | Persist, resume, or discard multi-step clinical/registration form drafts. |
| `/api/events/publish` | POST | SessionCookie (facility-isolated) | `—` | 200, 400, 500 | Publish facility operational event to real-time bus / EventBridge. |
| `/api/facility/stream` | GET | SessionCookie (facility-isolated) | `?facilityId` | 200 | Subscribe to facility Server-Sent Events (SSE) live clinical & billing updates. |
| `/api/facility/sync` | GET, PUT, POST, DELETE | SessionCookie (facility-isolated) | `?facilityId, ?key, facilityId, data, key, value` | 200, 400 | Read, upsert, or remove multi-device facility_kv keys with relational Postgres projection. |
| `/api/fhir/epcr-bridge` | GET, POST | SessionCookie (facility-isolated) | `?facilityId, resourceType, entry, identifier, recipient, etaMinutes, id` | 200, 400 | Exchange HL7 FHIR bundles with ambulance ePCR bridge. |
| `/api/gemini` | GET, POST | SessionCookie (facility-isolated) | `?facilityId, facilityId, roleKey, prompt, systemHint, ragContext, history` | 200, 400, 502, 503 | Server-side Gemini Interactions & generation proxy (never exposes key to browser). |
| `/api/orthanc/studies` | GET | SessionCookie (facility-isolated) | `?base, ?user, ?pass` | 200, 400, 502 | Query Orthanc PACS DICOM studies for facility. |
| `/api/patients` | GET, POST, DELETE | SessionCookie (facility-isolated) | `?facilityId, ?q, ?limit, ?id, id, patientId, facilityId, fullName, name, facilityName` | 200, 400, 500, 503 | List, search, create/update, or delete facility-scoped patient records in PostgreSQL. |
| `/api/paystack/initialize` | POST | SessionCookie (facility-isolated) | `amountNgn, email, reference, metadata, channels` | 200, 400, 500, 503 | Initialize Paystack card/transfer transaction for patient invoice. |
| `/api/paystack/terminal` | POST | SessionCookie (facility-isolated) | `amountNgn, email, reference, deviceId, terminalId, metadata` | 200, 400, 500, 503 | Trigger Paystack POS Terminal payment intent. |
| `/api/paystack/verify` | GET, POST | SessionCookie (facility-isolated) | `?reference, reference` | 200, 400, 500, 503 | Verify Paystack payment reference. |
| `/api/paystack/webhook` | POST | Public Webhook (HMAC signature / verify token) | `—` | 200, 400, 401, 503 | HMAC-SHA512 verified Paystack webhook receiver. |
| `/api/referrals/hie` | GET, POST, PATCH | SessionCookie (facility-isolated) | `?facilityId, ?direction, patientName, hospitalNumber, targetFacilityId, referringFacilityId, referringFacilityName, targetFacilityName` | 200, 201, 400, 404, 500 | Create, bed-lock, accept, update, or discharge inter-facility HIE referrals. |
| `/api/sms/send` | POST | SessionCookie (facility-isolated) | `to, body` | 200, 502, 503 | Send patient/staff SMS notification via configured gateway. |
| `/api/staff` | GET, POST, DELETE | SessionCookie (facility-isolated) | `?facilityId, ?badgeId, badgeId, facilityId, fullName, name, email, pin` | 200, 400, 500, 503 | List, create/update, or remove facility staff directory records. |
| `/api/staff/create` | POST | Admin SessionCookie (role: hospital_admin|sysadmin|medical_director or clearance >= 4) | `—` | 200, 400, 500, 503 | Provision staff member and Firebase Auth credential (Admin only). |
| `/api/staff/delete-all-auth` | GET, POST | Admin SessionCookie (role: hospital_admin|sysadmin|medical_director or clearance >= 4) | `confirm` | 200, 400, 401, 500, 503 | Bulk remove staff authentication records for a facility (Admin only). |
| `/api/staff/delete-auth` | POST | Admin SessionCookie (role: hospital_admin|sysadmin|medical_director or clearance >= 4) | `badgeId, email, facilityId` | 200, 400, 401, 500, 503 | Revoke single staff authentication credential (Admin only). |
| `/api/staff/flush-facility` | POST | Admin SessionCookie (role: hospital_admin|sysadmin|medical_director or clearance >= 4) | `confirm, facilityId` | 200, 400, 401, 500, 503 | Flush facility sandbox/pilot records (Admin only). |
| `/api/staff/lookup` | GET | Public (no session cookie required; rate-limited / route-level token checks) | `?facilityId, ?badgeId, ?query` | 200, 400 | Public pre-login badge lookup by facility and badge ID. |
| `/api/storage/object` | GET | SessionCookie (facility-isolated) | `?key` | 200, 400, 403, 404, 500, 503 | Authenticated proxy download/stream for private S3 objects. |
| `/api/storage/presigned-url` | POST | SessionCookie (facility-isolated) | `contentType, mimeType, folder, filename, facilityId, patientId` | 200, 400, 500, 503 | Generate pre-signed S3 upload URL with tenant-isolated key prefix. |
| `/api/storage/status` | GET | SessionCookie (facility-isolated) | `—` | 200 | Check S3 storage configuration and health. |
| `/api/storage/upload` | POST | SessionCookie (facility-isolated) | `dataUrl, image, base64, folder, facilityId, filename` | 200, 400, 413, 415, 500, 503 | Upload encrypted clinical media/avatar payload to private S3 bucket. |
| `/api/whatsapp/triage` | OPTIONS, GET, POST | Public Webhook (HMAC signature / verify token) | `object, entry, text, audioBase64, mimeType, language` | 200 | Meta WhatsApp Cloud API verification challenge & voice/text triage webhook. |

## 3. MOH Oversight Portal Route Handlers (`apps/admin/src/app/api`)

| Path | Methods | Query / Body Params | Status Codes | Purpose |
|------|---------|---------------------|--------------|---------|
| `/api/moh/alerts` | POST, PATCH | `condition, icd10Category, detectedCases, rateOfIncrease, affectedDistricts, severity` | 200, 400, 404, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/alerts) |
| `/api/moh/audits` | GET, POST, PATCH | `facilityId, facilityName, auditDate, auditorName, category, resolutionDeadline` | 200, 400, 404, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/audits) |
| `/api/moh/directives` | GET, POST, PATCH | `title, summary, category, severity, targetDistricts, targetTiers` | 200, 400, 404, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/directives) |
| `/api/moh/enforcement` | GET, POST, PATCH | `?district, action, facilityName, lga, facilityId, district, ownership` | 200, 400, 404, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/enforcement) |
| `/api/moh/facilities` | PATCH | `facilityId, emergencyStatus, accreditationStatus, operationalStatus, licenseNo, licenseExpiry` | 200, 400, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/facilities) |
| `/api/moh/facilities/{facilityId}` | GET, POST | `title, body, level, sentBy` | 200, 400, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/facilities/{facilityId}) |
| `/api/moh/grievances` | GET, POST, PATCH | `?district, facilityId, summary, facilityName, lga, channel, category` | 200, 400, 404, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/grievances) |
| `/api/moh/hrh` | GET, POST, PATCH | `?district, title, cadre, facilityId, facilityName, lga, vacanciesCount` | 200, 400, 404, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/hrh) |
| `/api/moh/idsr` | GET, POST, PATCH | `?district, reportKind, lga, facilityId, disease, facilityName, district` | 200, 400, 404, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/idsr) |
| `/api/moh/intelligence` | POST | `question, district` | 200, 400 | MOH Oversight (apps/admin) endpoint (/api/moh/intelligence) |
| `/api/moh/snapshot` | GET | `?district, ?facilityId` | 200, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/snapshot) |
| `/api/moh/stream` | GET | `—` | 200 | MOH Oversight (apps/admin) endpoint (/api/moh/stream) |
| `/api/moh/supply-infra` | GET, POST, PATCH | `?district, facilityId, itemName, id, domain, facilityName, lga` | 200, 400, 404, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/supply-infra) |
| `/api/moh/transfers` | GET, POST, PATCH | `staffName, fromFacilityId, toFacilityId, staffBadge, cadre, fromFacilityName` | 200, 400, 404, 500 | MOH Oversight (apps/admin) endpoint (/api/moh/transfers) |

## 4. Express Hub API (`services/api-server`)

For the on-premise LAN / WebSocket Clinical Event Hub endpoints (`/api/v1/lab/results`, `/api/v1/cpoe/order-sets/apply`, etc.), see [API_REFERENCE.md](../API_REFERENCE.md).

## 5. Regenerating This Documentation

Whenever you add, rename, or update an API route handler or middleware rule, run:

```bash
npm run docs:openapi
```
