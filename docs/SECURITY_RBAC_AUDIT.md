# Security, RBAC Matrix, PHI Protection & Audit Trail

> **Compliance posture:** Aligned with Nigerian NDPR, Federal Ministry of Health (FMOH) NDHA guidelines, HIPAA Security Rule (§164.312), and 21 CFR Part 11 tamper-evident electronic recordkeeping.

---

## 1. Role-Based Access Control (RBAC) Matrix

Access control is enforced at **two independent layers**:
1. **Server Edge & API Layer** ([`apps/os/src/middleware.ts`](../apps/os/src/middleware.ts)): Validates the signed HttpOnly session cookie (`medcore_session_token`), checks `clearanceLevel >= 4` / admin `roleKey` on `ADMIN_ONLY_API_PREFIXES` and `DELETE /api/staff`, and blocks cross-facility queries (`x-medcore-facility-id`).
2. **Client Module & Patient Data Scopes** ([`apps/os/src/lib/rolePermissionsStore.ts`](../apps/os/src/lib/rolePermissionsStore.ts)): Controls workspace modules, prescribing authority (`roleCanPrescribe()`), 17 granular `patient.*` scopes (`roleCanSeePatientData()`), and explicit `ROLE_MODULE_DENY` blocks. Hospital Admins may customize role scopes via the Role Visibility Matrix.

### Core Role Permission Matrix

Legend: **C** = Create · **R** = Read · **U** = Update · **D** = Delete · **—** = Denied (`ROLE_MODULE_DENY` / excluded by default)

| Role (`roleKey`) | Patient Identity / MPI | Vitals & Triage | Clinical Notes / EMR | Prescriptions (`roleCanPrescribe`) | Lab & Imaging Orders/Results | Billing / Cashier / Claims | Staff, RBAC & System Admin | Audit Ledger & Compliance |
|---|---|---|---|---|---|---|---|---|
| **Hospital Admin** (`hospital_admin`) | C, R, U, D | R / Admin (`*`) | R / Admin (`*`) | Emergency Admin Override | R / Admin (`*`) | C, R, U | C, R, U, D (`*`) | R, Export, Verify |
| **ICT / SysAdmin** (`sysadmin`) | — (no clinical chart) | — | — | — | — | AkwaRemit oversight | C, R, U, D (Staff/RBAC/FHIR) | R, Export, Anchor |
| **Medical Director** (`medical_director`) | R | R (`patient.full_chart`) | R, C, U (Sign) | C, R, U | C, R, U | AkwaRemit R | R (Facility Oversight) | R, Compliance |
| **Doctor** (`doctor`) | R | R, C | C, R, U (Sign) | C, R, U (Prescribe) | C, R | — | — | Scoped (`clinical`) |
| **Surgeon** (`surgeon`) | R | R | C, R, U (OT/Procedure) | C, R, U (Prescribe) | C, R | — (OT/CSSD only) | — | Scoped (`clinical`) |
| **Nurse** (`nurse`) | R | C, R, U | C, R (Nursing/MAR/I-O) | — (Administer MAR only) | R | — | — | Scoped (`clinical`) |
| **Midwife** (`midwife`) | R | C, R, U | C, R (Maternity/Birth) | — | R | — | — | Scoped (`clinical`) |
| **Pharmacist** (`pharmacist`) | R | — | Problem/Allergy/Med R | Dispense / Verify / Defer (`—` prescribe) | — | Pharmacy POS (`—` patient flow) | — | Scoped (`pharmacy`) |
| **Lab Scientist** (`lab`) | R | R | — (`ROLE_MODULE_DENY`) | — (`ROLE_MODULE_DENY`) | C, R, U (Validate Results) | — (`ROLE_MODULE_DENY`) | — | Scoped (`clinical`) |
| **Radiologist** (`radiologist`) | R | — | Problem/Imaging R (`—` OPD) | — (`ROLE_MODULE_DENY`) | C, R, U (DICOM/Reports) | — (`ROLE_MODULE_DENY`) | — | Scoped (`clinical`) |
| **Reception** (`reception`) | C, R, U (Check-in) | Triage Routing | — (`ROLE_MODULE_DENY`) | — (`ROLE_MODULE_DENY`) | — (`ROLE_MODULE_DENY`) | Eligibility / Queue Billing | — (`ROLE_MODULE_DENY`) | Scoped (`access`) |
| **HIM / Records** (`records`) | C, R, U (MPI / HIM / ROI) | — | HIM Coding & Chart Deficiency R | — (`ROLE_MODULE_DENY`) | — (`ROLE_MODULE_DENY`) | Insurance Claims (`—` Cashier) | — (`ROLE_MODULE_DENY`) | Scoped (`records`) |
| **Accountant / Cashier** (`accountant`) | R (`patient.identity`) | — | — (`ROLE_MODULE_DENY`) | — (`ROLE_MODULE_DENY`) | — (`ROLE_MODULE_DENY`) | C, R, U (POS, Batch Settle, Claims) | — | Scoped (`financial`) |
| **Biomedical / Eng** (`biomedical`) | — | — | — | — | IoT Devices Only | — | — | — |

> **Specialty & Custom Roles:** `dentist`, `ophthalmologist`, `physiotherapist`, `nutritionist`, `psychiatrist`, `oncologist`, `dialysis_nurse`, `mortuary_attendant`, and `cssd_technician` inherit tightly scoped module lists; custom facility roles created via `createCustomRole()` default to `['dashboard', 'my-card', 'patient-360', 'emr', 'notifications']`.

---

## 2. How Protected Health Information (PHI) Is Encrypted & Isolated

### In Transit
- **Browser ↔ Next.js (`apps/os`, `apps/admin`):** Served over HTTPS/TLS (`secure: process.env.NODE_ENV === 'production'` on session cookies).
- **Session & MFA Tokens ([`apps/os/src/lib/serverSession.ts`](../apps/os/src/lib/serverSession.ts)):** Authenticated sessions use an **HMAC-SHA256 signed, HttpOnly, SameSite=Lax** cookie (`medcore_session_token`, 12-hour TTL). Short-lived 2FA proofs (`mfa.*`, 5-minute TTL) bind `badgeId`, `facilityId`, and verification `method` (`email_otp` | `code` | `biometric`). *Production checklist: configure a high-entropy `MEDCORE_SESSION_SECRET` (never rely on the dev fallback string).*
- **Application ↔ PostgreSQL:** Connects over TLS (`ssl: { rejectUnauthorized: ... }` / `PGSSLMODE=require`) using **Vercel AWS OIDC IAM token signing** (`@aws-sdk/rds-signer` with short-lived dynamic auth tokens, avoiding static DB passwords in production).
- **External Integrations:** All AI, biometric, messaging, PACS, and payment APIs run strictly **server-side** over HTTPS so provider API keys never reach browser bundles (`NEXT_PUBLIC_` is prohibited for secrets).

### At Rest & on Shared Workstations
- **Database (AWS Aurora / RDS PostgreSQL):** Storage volumes, automated snapshots, and read replicas are encrypted at rest with **AES-256 (AWS KMS)**. Every tenant table enforces **PostgreSQL Row-Level Security (RLS)** (`app.current_facility_id`).
- **Clinical Media & Scanned Documents (AWS S3):** Stored in a **private S3 bucket with Block Public Access ON** and tenant-isolated prefixes (`<facilityId>/<folder>/<patientId>/<file>`). Images are served back strictly through the authenticated proxy endpoint [`GET /api/storage/object`](../apps/os/src/app/api/storage/object/route.ts), never raw public URLs.
- **Credentials & Local Storage Hygiene ([`apps/os/src/lib/hipaaPrivacy.ts`](../apps/os/src/lib/hipaaPrivacy.ts)):**
  - Staff PINs are hashed (`sha256` in DB); primary auth uses Firebase Auth + Email OTP / Facial Biometric 2FA.
  - `stripSecretsDeep()` and `sanitizeStorageString()` strip `pin`, `password`, `pinHash`, `token`, `secret`, `apiKey`, and webhook secrets before any client cache write.
  - `scrubPhiOnLogout()` immediately purges all **23 `PHI_LOCAL_STORAGE_KEYS`**, clears `sessionStorage`, terminates the server session cookie (`DELETE /api/auth/session`), and records `HIPAA_WORKSTATION_LOGOUT` or `HIPAA_INACTIVITY_AUTOLOCK`.

---

## 3. Third-Party Services & PHI Exposure Inventory

| Service / Provider | Where Used | Data Sent | PHI Exposure | Safeguards |
|---|---|---|---|---|
| **AWS Aurora / RDS PostgreSQL** | Core EMR system of record | All patient, clinical, billing, audit rows | **Yes (Primary PHI Store)** | AES-256 KMS at rest, TLS in transit, IAM OIDC auth, Postgres RLS per `facility_id` |
| **AWS S3** | Clinical photos, scanned forms, staff ID headshots | Image/PDF objects under tenant prefix | **Yes (Media PHI)** | Private bucket, Block Public Access ON, authenticated `/api/storage/object` proxy |
| **AWS Rekognition** | `apps/os/src/app/api/auth/biometric/**` | **Staff** live face frames & enrolled descriptors only | **No Patient PHI** | Staff authentication 2FA only; encrypted server IAM/OIDC calls |
| **Google Gemini API** | `apps/os/src/app/api/ai/*`, `/api/gemini`, `apps/admin/src/app/api/moh/intelligence` | Clinical prompts, scanned forms/images, audio transcripts | **Yes (Transient Processing)** | Strict server-side proxy (`GEMINI_API_KEY` never exposed to client); stateless inference |
| **Firebase Auth / Firestore** | `AuthScreen`, staff Auth lifecycle, optional mirror | Staff email/UID, facility mirror docs | **Minimal / Mirror** | PINs stripped; Admin SDK server-only for staff deletion |
| **Resend / Email Webhook** | `/api/auth/mfa` | Staff email & 6-digit OTP code | **No Patient PHI** | Masked email UI, hashed OTP (`staff_otp_challenges`), short TTL |
| **Paystack & AkwaRemit** | `/api/paystack/*`, `/api/akwaremit/*` | Invoice ID, amount (NGN), payer metadata | **Financial / Billing Ref** | HMAC webhook signature verification; no clinical diagnosis/notes sent |
| **AKSHIA / NHIA & DHIS2** | `/api/akshia/*`, `/api/dhis2/submit` | Insurance claims (`icd11_code`, enrollee ID) or **aggregate** counts | **Claims / Aggregate Stat** | DHIS2 payloads are aggregate facility counts; claims require staff session |
| **Meta WhatsApp Cloud API & SMS Gateway** | `/api/whatsapp/triage`, `/api/care/reminders`, `/api/sms/send` | Appointment/ANC reminders, triage replies, phone number | **Minimal Scheduling PHI** | Webhook verify token, opt-in care reminders, scoped templates |
| **AWS EventBridge & Vercel** | `/api/events/publish`, hosting, `@vercel/speed-insights` | App hosting, facility event metadata, web vitals | **Platform / Telemetry** | Speed Insights captures anonymous performance telemetry only |
| **Optional External Merkle Anchor Webhook** | `/api/audit/anchor` (`MERKLE_ANCHOR_WEBHOOK_URL`) | SHA-256 `merkleRoot`, `anchorId`, `leafCount` | **Zero PHI (`zeroPhiCertified: true`)** | Operates strictly on hashes of audit ledger rows — zero patient/staff strings leave the DB |

---

## 4. Tamper-Evident Audit Trail Architecture

MedCore maintains an immutable, hash-chained audit trail across both workstation events and PostgreSQL:

1. **What Is Logged:**
   - **Chart Access & Clinical Actions (`clinical`):** Patient chart opens, vitals entry, clinical note creation/signing, HIE referrals, diagnosis/order entry.
   - **Pharmacy (`pharmacy`):** Prescription verification, `DEFERRED` holds, NAFDAC check overrides, dispensing.
   - **Financial (`financial`):** Invoice generation, cash/Paystack receipts, refunds/waivers, Accountant batch settlements.
   - **Records (`records`):** MPI registration, patient merges, HIM coding, archival.
   - **Access & Security (`access`):** Staff logins, failed PIN attempts, 2FA verification, inactivity auto-locks (`HIPAA_INACTIVITY_AUTOLOCK`), logout PHI scrubs, RBAC/settings changes.

2. **How Hash-Chaining Works ([`auditLogStore.ts`](../apps/os/src/lib/auditLogStore.ts) & [`api/audit/route.ts`](../apps/os/src/app/api/audit/route.ts)):**
   - Every entry stores `id`, ISO timestamp `at`, `facilityId`, `actor`, `actorBadge`, `category`, `severity` (`normal` | `notable` | `critical`), `action`, `entity`, `entityId`, `detail`, `prevHash`, and `rowHash`.
   - The server computes `rowHash = SHA-256(prevHash | at | facilityId | actor | actorBadge | action | entity | entityId | detail)` (`GENESIS...` for the first facility event) and inserts into `clinical_audit_ledger` with `ON CONFLICT (facility_id, id) DO NOTHING` (append-only).
   - Events broadcast live to facility compliance dashboards via SSE (`publishFacilitySseEvent`).

3. **Zero-PHI Merkle Root Anchoring & Verification ([`merkleAnchorEngine.ts`](../apps/os/src/lib/merkleAnchorEngine.ts) & [`/api/audit/anchor`](../apps/os/src/app/api/audit/anchor/route.ts)):**
   - Triggered manually or nightly by [`/api/cron/daily-ops`](../apps/os/src/app/api/cron/daily-ops/route.ts) (`07:00 UTC` via Vercel Cron).
   - Builds a binary SHA-256 Merkle tree (`buildMerkleTree()`) over recent `row_hash` values and stores a receipt in `merkle_anchors` (`sealed_local` or `anchored_onchain` when an L2/external webhook is configured).
   - **Independent Verification:** Compliance officers can export full CSV chains (`exportAuditCsv()`), verify chain linkage (`verifyAuditChain()`), or verify inclusion proofs in browser/Node via `generateMerkleProof()` & `verifyMerkleProof()`.
