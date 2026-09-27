# Statewide operations (item 5)

## Model
- **One** API + **one** Postgres for all facilities.
- Every clinical row carries **`facilityId`**.
- Clients send **`X-Facility-Id`** (or `facilityId` query/body). Middleware attaches `req.facilityId`.

## MPI / card portability
- State Health ID on registration (`AKS-HID-…`).
- `GET /api/v1/hie/mpi/search`, `/hie/shr/:hid`, `/hie/shr/:hid/fhir`.
- Consent: `POST /api/v1/hie/consent` before cross-facility SHR (unless pilot=true).

## MOH Admin
- `GET /api/v1/admin/statewide-census`
- `GET /api/v1/admin/facility-activity`

## Claims / NHIA path
- Package: `/api/v1/hcx/eclaim`
- Eligibility: `/api/v1/hmo/eligibility`
- Connect live HCX/NHIA endpoints via `HCX_BASE_URL` when available.

## Adding a facility
1. Register facility in facilities table / Facility Onboarding UI.
2. Enrol **one** hospital admin for that facility only.
3. Admin enrols local staff; they log in with badges scoped to `hospitalId`.
4. Point OS session facility to the new hospital id.

## Storage (5 TB envelope)
See `docs/DEPLOY_AWS.md` — Postgres ≤1 TB structured data; S3 for docs/backups; **0** for CCTV video.
