# MedCore ↔ Nigeria MoH / NDHA / NHIA Compliance Matrix

**Purpose:** Commissioner / ICT / AKSHIA brief — alignment vs full certification.  
**Product:** MedCore Hospital OS (Akwa Ibom)  
**Policy refs:** NDHI, NDHA (FHIR R4, HIE, HCX), NHMIS/DHIS2, NHIA/SSHIAs, NDPA/NDPR, NHTDAO priorities.

---

## 1. Alignment summary

| Area | Status | Evidence in product |
|------|--------|---------------------|
| Facility EMR digitisation (NDHI) | **Aligned / operational** | Full Hospital OS: EMR, CPOE, pharmacy EML, lab, beds, revenue |
| FHIR R4 exchange | **Aligned (profiles tagged)** | `/api/v1/fhir/*`, HCX eClaim `application/fhir+json` |
| HIE / Shared Health Record | **Designed — not federal-onboarded** | Patient FHIR export; no live national HIE join yet |
| Health Claims Exchange (HCX) | **Packager ready** | `/api/v1/hcx/eclaim` FHIR Claim; optional `HCX_BASE_URL` submit |
| NHIA / AKSHIA | **Operational path** | `/api/v1/hmo/eligibility`, `/claims`; HCX packaging |
| DHIS2 / NHMIS | **Bridge live or simulated** | `/api/v1/dhis2/aggregate`, `/tracker/event`; env for real instance |
| NDPR / data protection | **Controls layer** | Consent, processing register, retention, breach log |
| Cybersecurity / audit | **Partial** | Immutable audit ledger, RBAC, break-glass concepts |
| Ethical AI | **HITL posture** | Gemini-backed insights with human oversight design |

**Bottom line:** Fit for **state facility operations** and **NDHA-direction**; **not** a claim of completed FMOH HIE/HCX certification.

---

## 2. API surface (compliance phase)

| Capability | Base path | Notes |
|------------|-----------|--------|
| FHIR R4 | `/api/v1/fhir` | Patient and clinical resources |
| DHIS2 / NHMIS | `/api/v1/dhis2` | Aggregate + tracker; `DHIS2_*` env for live |
| HCX eClaim | `/api/v1/hcx` | Package & optional submit |
| HMO eligibility/claims | `/api/v1/hmo` | AKSHIA/NHIA demo policies |
| NDPR controls | `/api/v1/ndpr` | Consent, register, breach |
| Realtime bus | `ws://host/ws` | Clinical + `DHIS2_SYNC_COMPLETE` |

---

## 3. Environment for production integration

```bash
# DHIS2 (State or National NHMIS)
export DHIS2_BASE_URL=https://your-dhis2.example
export DHIS2_USERNAME=...
export DHIS2_PASSWORD=...
export DHIS2_ORG_UNIT=...   # facility org unit UID
export DHIS2_DATASET=...    # NHMIS dataset UID

# HCX (when exchange endpoint available)
export HCX_BASE_URL=https://hcx.example/api
export HCX_API_KEY=...

# Optional
export NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
```

Without these, bridges run **SIMULATED** (safe for pilot; no false “live national” claim).

---

## 4. Governance checklist (facility / state)

- [ ] Appoint **DPO** and document processing under NDPA  
- [ ] Map org unit & datasets with **State HMIS** (DHIS2)  
- [ ] Empanel facility with **AKSHIA**; align tariff codes  
- [ ] Formal **DPIA** for EMR + AI + SMS  
- [ ] Backup / retention SOP (clinical ≥7 years)  
- [ ] Engage **NHTDAO / NDHTO** when seeking HIE onboarding  
- [ ] Rotate secrets; no PATs in repo remotes  

---

## 5. What “done” means for next certification steps

1. **DHIS2 live:** successful aggregate for one reporting period against State instance  
2. **HCX:** accepted eClaim from MedCore packager on pilot exchange  
3. **HIE:** Patient/Encounter write to Shared Health Record under national profiles  
4. **NDPR:** filed processing notification / DPIA as required by counsel  

Until then, market and brief as: **NDHA-aligned facility OS with production bridges ready for credentialed endpoints.**
