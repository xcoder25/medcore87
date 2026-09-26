# Phase 3 & 4 — Statewide HIE + Differentiation

## Phase 3 APIs
- GET /api/v1/hie/mpi/search
- GET /api/v1/hie/mpi/state-health-id/:hid
- GET /api/v1/hie/mpi/nin/:nin
- POST /api/v1/hie/consent
- GET /api/v1/hie/shr/:hid
- GET /api/v1/hie/shr/:hid/fhir
- POST /api/v1/hie/shr/ingest
- GET /api/v1/hie/status
- GET /api/v1/patients/longitudinal/:hid
- GET /api/v1/admin/statewide-census
- GET /api/v1/admin/facility-activity

## Phase 4 APIs
- POST /api/v1/ai/soap-assist (HITL)
- POST /api/v1/ai/propose-clinical-action
- POST /api/v1/ai/approve-action
- GET /api/v1/connectathon/tracks
- POST /api/v1/connectathon/immunization
- POST /api/v1/connectathon/mnch-referral
- POST /api/v1/connectathon/devices/telemetry

## OS
Module `statewide-hie` → StatewideHiePanel

## Honest gaps
Federal HIE onboarding, full mobile Clinic/Care parity, production multi-region DB, formal DHIN certification.
