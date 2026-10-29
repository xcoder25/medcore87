# MedCore OS — Comprehensive Tester Manual
**Version 2.0 · October 2026 · Akwa Ibom State Health Systems**

> This is the definitive guide for QA engineers, clinical acceptance testers, hospital ICT leads,
> and UAT participants validating MedCore OS before go-live.

---

## Table of Contents
1. [Test Environment Setup](#1-test-environment-setup)
2. [Demo Login Accounts](#2-demo-login-accounts)
3. [Role-Based Navigation & Access](#3-role-based-navigation--access)
4. [Module Test Suites](#4-module-test-suites)
5. [End-to-End Patient Journey Tests](#5-end-to-end-patient-journey-tests)
6. [LIVE Event Bus Tests (API)](#6-live-event-bus-tests-api)
7. [Offline / Poor-Network Tests](#7-offline--poor-network-tests)
8. [Acceptance Criteria Checklist](#8-acceptance-criteria-checklist)
9. [Known Limitations & Workarounds](#9-known-limitations--workarounds)
10. [Bug Reporting Template](#10-bug-reporting-template)

---

## 1. Test Environment Setup

### Prerequisites
| Requirement | Specification |
|-------------|--------------|
| Browser | Chrome 120+ or Edge 120+ (desktop) |
| Screen resolution | Min 1280 × 800 px |
| Node.js | v18+ |
| Ports required | 3003 (OS app), 4000 (API server) |

### Starting the Platform

**Terminal A — API + WebSocket backend**
```bash
cd medcore/services/api-server
npm install
npm run dev
# Confirm: http://localhost:4000/ and ws://localhost:4000/ws are reachable
```

**Terminal B — MedCore OS UI**
```bash
cd medcore/apps/os
npm install
npm run dev
# Open: http://localhost:3003
```

> ✅ **LIVE indicator** — Top bar shows a pulsing green **LIVE** badge when WebSocket is connected.
> Orange/grey = API server not running.

### Environment Variables (optional)
```bash
NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
GEMINI_API_KEY=<key>        # enables live Gemini AI queries
DHIS2_BASE_URL=<url>        # links to national NHMIS
```

---

## 2. Demo Login Accounts

All accounts are scoped to **Ibom Specialist Hospital, Uyo** (`facilityId: AKS-IBOM-SPECIALIST`).

| Role | Email | Password | Access Level |
|------|-------|----------|-------------|
| Medical Director | c.okoro@ibomspecialist.gov.ng | admin123 | L5 — Full |
| Consultant Doctor | a.bello@ibomspecialist.gov.ng | doctor123 | L3 — Clinical |
| Senior Nurse | c.okeke@ibomspecialist.gov.ng | nurse123 | L3 — Nursing |
| Pharmacist | i.musa@ibomspecialist.gov.ng | pharm123 | L3 — Pharmacy |
| Lab Scientist | e.nwosu@ibomspecialist.gov.ng | lab123 | L2 — Lab |
| Front Desk | f.adeyemi@ibomspecialist.gov.ng | reception123 | L1 — Reception |
| HMO Biller | billertest@ibomspecialist.gov.ng | billing123 | L2 — Finance |
| ICT Admin | ict@ibomspecialist.gov.ng | sysadmin123 | L5 — System |

---

## 3. Role-Based Navigation & Access

After login the sidebar auto-configures. Verify each role sees **only** their permitted modules:

| Role | Key Nav Items |
|------|--------------|
| Doctor | Clinical desk · OPD queue · Doctor portal · Patient 360 · Clinical Google · EMR · CPOE |
| Nurse | Ward station · Inpatient e-MAR · Triage vitals · Beds · Maternity · Paediatrics |
| Pharmacist | Pharmacy dispensing · Formulary · e-Prescribing · Claims |
| Lab Scientist | LIS analyzer · Lab orders · Results |
| Reception | Front desk · Appointments · Queue · Cashier |
| Admin/Director | Full 7-pillar directory (all 40 modules) |

**Access control test:** Navigate to a forbidden URL directly → expect redirect to dashboard or Access Denied.

---

## 4. Module Test Suites

### 4.1 Authentication & Onboarding
1. Open `http://localhost:3003` → auth splash renders
2. Enter invalid credentials → red error toast
3. Enter valid doctor credentials → redirected to Physician Workstation
4. Click Sign Out → session cleared, redirect to login
5. **First-run wizard:** click "Set up a new hospital" → complete 6-step wizard → facility saved

✅ **Pass:** Auth < 2 s; session stored in sessionStorage; onboarding completes.

---

### 4.2 Command Centre Dashboard
1. Log in as Medical Director → **Hospital Operations Hub**
2. Live metrics render: Occupied beds, Inpatients, Emergency, OPD visits
3. Alert feed shows recent events
4. Click a metric card → department drill-down panel
5. LIVE badge green when API running

✅ **Pass:** Dashboard loads < 3 s; all metric tiles render.

---

### 4.3 Clinical Google Search (GenAI) ⭐ New
1. Log in as Doctor → **Clinical Google (Search EMR)**
2. Default patient: Mrs Blessing Etim (PAT-AKS-4401)
3. Type query: *"Summarize this patient's history of hypertension medications and show me their highest creatinine level."*
4. Press Enter → result within 0.3 s

**Expected output:**
- Summary mentions **186 µmol/L** creatinine (14-Jun-2024)
- Drug progression: Amlodipine → Telmisartan → Nifedipine
- ≥ 4 clinical citations with source type + date
- 3 action hooks: "Insert into SOAP Note" · "Order Repeat Creatinine STAT" · "Audit Regimen vs eGFR"

5. Switch to PAT-AKS-8812 (Mrs Amaka Chukwu — obstetric)
6. Query: *"What is her gestational blood pressure trajectory and pre-eclampsia screen?"*
7. Expected: **152/98 mmHg** peak BP + **420 mg/24 h** proteinuria

**Automated verification:**
```bash
cd apps/os
npx tsx scratch/verify_features.ts
# Must print: 🎉 ALL TESTS PASSED 100%
```

✅ **Pass:** All 4 assertions green; copy button works; empty query disabled.

---

### 4.4 AI Clinical Automations Suite ⭐ New
1. Navigate to **AI Clinical Automations**
2. **AI Scribe tab:** Start ambient recording → Stop → SOAP note generated with S/O/A/P sections → "Insert into EMR"
3. **Discharge Prep tab:** Select inpatient → "Generate Discharge Summary" → drug reconciliation + allergy check
4. **Early Warning tab:** Patient list shows NEWS2 scores; ≥ 7 = RED badge; 5–6 = AMBER
5. **Safety tab:** Consent checklist; BCP status

✅ **Pass:** All 4 tabs render; SOAP < 2 s; NEWS2 scores match triage vitals.

---

### 4.5 Celestia M87 AI Copilot
1. Navigate to **Celestia** (Brain icon)
2. Query: "What is current ICU bed occupancy?"
3. Query: "Show patients with critical NEWS2 scores today"
4. Query: "Draft referral letter for PAT-AKS-4401 to nephrology"
5. Response streams token by token; referral contains patient name, diagnosis, reason

---

### 4.6 EMR & Intelligent Records
1. Search patient "Blessing Etim" → select
2. Chart tabs: Summary · Notes · Orders · Results · Medications
3. New SOAP note → save → appears in timeline
4. Lab order (FBC) → appears in Lab queue
5. Prescribe Amlodipine 5mg OD → drug interaction check runs
6. Allergy banner visible for documented allergies

✅ **Pass:** Search < 1 s; order appears in LIS queue.

---

### 4.7 Emergency & A&E Triage
1. Register walk-in: Name, Age, Chief Complaint
2. Enter vitals: BP 90/60 · HR 140 · SpO2 88% · Temp 38.9°C · GCS 12
3. Expected: **ESI Level 1 (Immediate)** auto-assigned, RED badge, top of queue
4. Assign Resuscitation Bay → bed confirmed

---

### 4.8 Rapid Nurse Triage (60-Second) ⭐ New
1. Navigate to **Rapid Triage Intake**
2. Enter hospital number → patient name auto-fills
3. Enter: BP 160/100 · HR 95 · Temp 37.2 · SpO2 97% · RR 18 · AVPU Alert · GCS 15
4. Chief complaint: "Severe headache, dizziness × 2 h"
5. Expected: **NEWS2 = 3 (Amber)** shown
6. Click Submit → toast + patient in OPD queue with urgency tag
7. Critical test: BP 80/50 · HR 150 · SpO2 85% → Expected: **ESI 1, CRITICAL, red alert**

✅ **Pass:** Submission < 1 s; NEWS2 correct; CRITICAL shows red.

---

### 4.9 – 4.19 (Specialty Suites)

For each suite below, verify: module loads, key forms save, data reflects in related modules.

| # | Module | Key Test |
|---|--------|---------|
| 4.9 | OPD Triage & Vitals | Sorted queue by urgency; vitals timeline |
| 4.10 | Operating Theatre | WHO checklist toggles; intraoperative record saves |
| 4.11 | ICU & Critical Care | Bed grid acuity; SOFA score displayed; ventilator params |
| 4.12 | Pharmacy Dispensing | Prescription queue; dispense decrements stock; interaction alert |
| 4.13 | Laboratory LIS | Collect → result → CRITICAL flag → doctor bell notification |
| 4.14 | Radiology & PACS | DICOM viewer renders; radiology report released |
| 4.15 | Maternity & O&G | ANC visit → pre-eclampsia alert; partograph; APGAR |
| 4.16 | Paediatrics & NICU | Incubator grid; newborn encounter; growth chart |
| 4.17 | Blood Bank | Blood request → cross-match → issue → inventory decrement |
| 4.18 | Inpatient Nursing | e-MAR administration timestamp; fluid balance; nursing note |
| 4.19 | Workflow Intelligence | AI recommendations; patient journey map |

---

### 4.20 Bed Management
1. Hospital map: Available / Occupied / Cleaning / Blocked
2. Admit → assign bed → census updates
3. Transfer Ward → ICU → census both wards update
4. Discharge → bed → "Cleaning" → "Available"

---

### 4.21 – 4.27 (Operations)

| # | Module | Key Test |
|---|--------|---------|
| 4.21 | Patient Flow | Sankey diagram; ALOS metric; date range filter |
| 4.22 | Universal Queue | Multi-column queue; call next; skip to bottom |
| 4.23 | Ambulance Fleet | Dispatch; ETA countdown; A&E handover |
| 4.24 | Medical Inventory | Stock request; goods receipt with batch/expiry; FIFO alert |
| 4.25 | Biomedical Equipment | Add device; fault report; close with resolution |
| 4.26 | Facilities & Utilities | O₂ pressure; generator fuel; maintenance log; threshold alert |
| 4.27 | Environmental Health | Waste disposal record; pest control log; infection audit |

---

### 4.28 Billing & Finance
1. Open patient encounter → auto-generated bill
2. Apply HMO: policy `AKSHIA-POL-88201` → co-pay calculated
3. Post payment → receipt generated and printable

**API test:**
```bash
curl -s -X POST http://localhost:4000/api/v1/hmo/eligibility \
  -H 'Content-Type: application/json' \
  -d '{"policyId":"AKSHIA-POL-88201","facilityId":"AKS-IBOM-SPECIALIST"}'
# Expected: {"eligible":true,"plan":"Comprehensive","copayPct":0}
```

---

### 4.29 AkwaRemit Revenue Hub
1. Today's collection summary: Cash · POS · Transfer · AKSHIA
2. End-of-day reconciliation → state remittance report generated

---

### 4.30 Insurance & HMO Claims
1. Pending claims list with status badges
2. Submit claim: ICD-10 + CPT codes attached
3. Adjudication within 2 s (demo)
4. Denial management: appeal reason filed

---

### 4.31 LAMIS & NDR Suite ⭐ New
1. Navigate to **LAMIS · NDR & e-CRVS**
2. HIV patient list: ART regimen, viral load, CD4 count
3. Click "Generate RADET" → file preview/download
4. NDR submission → status 200 OK
5. e-CRVS birth registration → certificate draft
6. Death registration form completes without error

---

### 4.32 Statewide EMR & AKSHIA
1. Facility readiness scorecard (all Akwa Ibom LGAs)
2. State patient registry search by UPI
3. AKSHIA enrolment → UPI barcode generated

---

### 4.33 FHIR R4 & HL7 Gateway
1. FHIR resource browser: GET `/Patient/PAT-AKS-4401` → valid FHIR R4 JSON
2. HL7 ADT^A01 messages visible in gateway log
3. SMART App Launch → OAuth2 URL generated

---

### 4.34 Offline Sync & Clinical Verification
1. DevTools → Network → Offline
2. Enter vitals → data saved locally (offline badge)
3. Reconnect → data syncs (progress indicator)
4. Conflict panel: Local vs Cloud values; choose resolution
5. USB Sneakernet: Export with passphrase → Import → records merged

---

### 4.35 Satellite & Telehealth Mesh (DTN) ⭐ New
1. Navigate to **Satellite & Telehealth Mesh**
2. Verify 6 LGA nodes: Essien Udim · Eastern Obolo · Ini · Creek Boat · Immanuel GH · State MoH
3. **Peer Discovery** → RSSI updates (−62 dBm on Essien Udim)
4. **Broadcast DTN Bundle** (TRIAGE_VITALS) → SHA-256 checksum in log; vector clock increments
5. **Satellite Uplink** → queue drops to 0; Merkle root starts with "0x"
6. **Simulate Blackout** → satellite state = "SEARCHING_SATELLITE"; banner appears
7. **Restore** → normal connectivity

**Automated test:**
```bash
cd apps/os && npx tsx scratch/verify_features.ts
# Expected: 🎉 ALL GENERATIVE AI CLINICAL GOOGLE & TELEHEALTH MESH TESTS PASSED 100%
```

---

### 4.36 – 4.40 (Governance)

| # | Module | Key Test |
|---|--------|---------|
| 4.36 | IoT Devices | Device list; waveform telemetry; threshold alarm |
| 4.37 | HIM Health Records | Deficiency list; ICD-10 coding; ROI export PDF; chart merge |
| 4.38 | Performance Analytics | KPI dashboard; date filter; CSV export |
| 4.39 | RBAC & Access Control | Create custom role; assign to user; verify access |
| 4.40 | System Administration | Audit log filter; manual backup; system health |

---

## 5. End-to-End Patient Journey Tests

### Journey 1: OPD Walk-In to Discharge

| # | Module | Action | Expected |
|---|--------|--------|----------|
| 1 | Reception | Register new patient | Hospital number assigned |
| 2 | Rapid Triage | 60-sec triage | NEWS2 calculated; queue updated |
| 3 | Universal Queue | Call patient | Status → "In Consultation" |
| 4 | Doctor Portal | SOAP note + Lab order | Order in Lab queue |
| 5 | Laboratory | Enter + release result | Bell notification to doctor |
| 6 | Doctor Portal | Review + prescribe | Prescription in Pharmacy queue |
| 7 | Pharmacy | Dispense | Stock decremented |
| 8 | Cashier | Collect payment | Receipt generated |
| 9 | HIM | Close + ICD-10 code | Encounter coded |

---

### Journey 2: Emergency Admission to Inpatient

| # | Module | Action | Expected |
|---|--------|--------|----------|
| 1 | A&E Triage | Register emergency | ESI 2; top of queue |
| 2 | Beds | Admit to General Ward | Bed assigned; census updates |
| 3 | Inpatient Nursing | e-MAR 08:00 meds | Administered timestamp logged |
| 4 | Laboratory | STAT FBC resulted | CRITICAL platelets alert fired |
| 5 | ICU | Transfer from ward | Bed moved; ICU census updates |
| 6 | AI Automations | Generate discharge summary | Reconciled meds + instructions |
| 7 | Billing | Final bill + HMO claim | Claim submitted |

---

### Journey 3: Maternity — ANC to Delivery

| # | Module | Action | Expected |
|---|--------|--------|----------|
| 1 | Reception | Register antenatal (G2P1) | Profile created |
| 2 | Maternity | ANC visit: BP 130/85, Protein 1+ | Pre-eclampsia MODERATE alert |
| 3 | Clinical Google | Query obstetric trajectory | 152/98 mmHg + 420 mg summary |
| 4 | Maternity | Labour + partograph | Cervical dilation plotted |
| 5 | Maternity | Delivery: SVD, APGAR 8/9 | Birth weight saved |
| 6 | Paediatrics | Newborn to NICU | Incubator assigned |
| 7 | e-CRVS | Birth registration | Certificate draft |

---

## 6. LIVE Event Bus Tests (API)

### Critical Lab Alert
```bash
curl -s -X POST http://localhost:4000/api/v1/lab/results \
  -H 'Content-Type: application/json' \
  -d '{"patientId":"PAT-1","patientName":"Uduak Essen","facilityId":"AKS-IBOM-SPECIALIST",
       "testName":"Troponin I","results":[{"parameter":"Troponin I","value":"2.1",
       "unit":"ng/mL","referenceRange":"<0.04","flag":"CRITICAL"}],"verifiedBy":"E. Nwosu"}'
```
**Expected:** Bell increments within 2 s; notification: "CRITICAL Troponin I 2.1 ng/mL — Uduak Essen"

### HMO Eligibility — Expired Policy
```bash
curl -s -X POST http://localhost:4000/api/v1/hmo/eligibility \
  -H 'Content-Type: application/json' \
  -d '{"policyId":"AKSHIA-POL-EXPIRED","facilityId":"AKS-IBOM-SPECIALIST"}'
```
**Expected:** `{"eligible":false,"reason":"Policy expired"}` — billing shows "HMO Not Eligible"

### Pharmacy Stock Depletion
```bash
curl -s -X POST http://localhost:4000/api/v1/pharmacy/stock/deplete \
  -H 'Content-Type: application/json' \
  -d '{"drugId":"amoxicillin-500","facilityId":"AKS-IBOM-SPECIALIST","quantityUsed":50}'
```
**Expected:** Pharmacy module shows stock-out warning.

### Full clinical loop (automated)
```bash
./scripts/demo-clinical-loop.sh
```

---

## 7. Offline / Poor-Network Tests

| Test | Method | Expected |
|------|--------|----------|
| Total offline | DevTools → Network → Offline | "Working Offline" badge; data entry works |
| Resume sync | Reconnect network | Queued changes sync; success toast |
| Poor connection | Throttle → Slow 3G | App degrades gracefully; no crashes |
| Sneakernet export | USB Export + passphrase | Encrypted `.mco` package created |
| Sneakernet import | USB Import | Records merged; conflicts flagged |
| Mesh blackout | Telehealth Mesh → Simulate Blackout | Nodes enter store-and-forward |
| Satellite flush | Sync via Satellite Uplink | Queue = 0; Merkle root generated |

---

## 8. Acceptance Criteria Checklist

### Performance
- [ ] All pages load < **3 seconds** on LAN
- [ ] LIVE event delivery < **2 seconds** end-to-end
- [ ] Triage submission < **1 second**
- [ ] Clinical Google response < **0.5 seconds**
- [ ] `npx tsc --noEmit` exits 0 (both apps/os and apps/care)

### Clinical Safety
- [ ] Drug–allergy interaction alert fires correctly
- [ ] NEWS2 ≥ 7 shows RED escalation banner
- [ ] ESI Level 1 placed at top of A&E queue
- [ ] Pre-eclampsia HIGH RISK fires at BP ≥ 140/90 + proteinuria 2+
- [ ] CRITICAL lab results trigger notification bell < 2 s

### Access & Security
- [ ] Role-based nav shows only permitted modules
- [ ] Forbidden URL → redirect to dashboard
- [ ] Audit log records every PHI access
- [ ] Session expires after inactivity

### Offline Capability
- [ ] Offline data entry works without network
- [ ] Data syncs correctly on reconnection
- [ ] Conflict resolution panel appears for conflicts
- [ ] Sneakernet USB export/import completes
- [ ] Mesh blackout simulation engages store-and-forward
- [ ] `scratch/verify_features.ts` → 100% pass

### Interoperability
- [ ] FHIR R4 Patient resource returns valid JSON
- [ ] HL7 ADT messages appear in gateway log
- [ ] LAMIS RADET export generates without error
- [ ] NDR submission → 200 OK
- [ ] e-CRVS certificate preview renders

### Financial
- [ ] HMO eligibility returns correct result
- [ ] Bill auto-generates from encounter charges
- [ ] Payment receipt printable
- [ ] End-of-day reconciliation completes

---

## 9. Known Limitations & Workarounds

| Limitation | Workaround |
|-----------|-----------|
| Gemini AI requires API key | Set `GEMINI_API_KEY`; local dossier mode works offline |
| DICOM viewer uses mock study | Configure `ORTHANC_URL` for real DICOM |
| SMS is simulated | Set `TERMII_API_KEY` for live SMS |
| Satellite uplink is simulated | Real hardware integration planned Q1 2027 |
| Paystack is sandbox mode | Set `PAYSTACK_SECRET_KEY` for live |
| Data in-memory without Postgres | Set `DATABASE_URL` for persistence |
| DHIS2 export is mocked | Set `DHIS2_BASE_URL` for national NHMIS |

---

## 10. Bug Reporting Template

```
## Bug Report

Module:      [e.g. Clinical Google Search]
Tester:      [Name]
Date/Time:   [2026-10-29 14:30 WAT]
Severity:    [Critical / High / Medium / Low]
Environment: [localhost:3003 / staging]

### Steps to Reproduce
1.
2.
3.

### Expected Result
[What should happen]

### Actual Result
[What happened instead]

### Console Errors / Screenshots
[Paste errors or attach screenshots]

### Login Used
[Email address]
```

---

*MedCore OS Tester Manual v2.0 · Powered by M87 · Akwa Ibom State Health Systems*
*Last updated: October 2026 · Commit: 5e45782*
