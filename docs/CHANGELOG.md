# MedCore OS — Release Notes & Changelog
**Powered by M87 · Akwa Ibom State Health Systems**

---

## v2.0.0 — October 2026 · *"Celestia Mesh"*
**Commit: 5e45782 · 23 files · 6,852 insertions**

### 🆕 New Features

#### Feature 1 — Generative AI "Clinical Google" Search
*"Ask the Patient File" — Replacing tedious menu-clicking with natural language EMR search*

- **`ClinicalGoogleSearchSuite.tsx`** — Full-featured AI search UI with:
  - Real-time query bar with suggested prompts
  - Patient selector (switch context between patients instantly)
  - Sub-0.5s synthesis with exact cited sources
  - Citation panel: date, source type (Lab/Pharmacy/Notes/Procedure), exact value, snippet
  - 1-click action hooks: insert into SOAP Note, order tests, audit regimens
  - Key metric cards (peak creatinine, gestational BP, etc.)
  - Bookmark and copy-to-clipboard on any result

- **`clinicalGoogleSearch.ts`** — Deterministic clinical NLP engine:
  - `askPatientFile(patientId, query)` → `ClinicalSearchAnswer`
  - Multi-intent query classifier (lab, medication, obstetric, allergy, procedure)
  - Patient dossier model: 5+ years lab history, full medication timelines, clinical notes
  - Exact-value extraction with citation linking
  - 2 pre-loaded clinical dossiers:
    - **PAT-AKS-4401** — Mrs Blessing Etim (hypertension + CKD) — peak creatinine 186 µmol/L
    - **PAT-AKS-8812** — Mrs Amaka Chukwu (antenatal, pre-eclampsia risk) — peak BP 152/98 mmHg

- **Integrated into:**
  - `moduleRegistry.tsx` → `clinical-search` module key
  - `roleNav.tsx` → visible to doctors, nurses, admins under "Clinical Assist"
  - `MODULE_CLEARANCE` → L2 access (all clinical staff)

#### Feature 5 — Smart Infrastructure & Telehealth Mesh (DTN)
*Decentralized peer-to-peer data sync for remote Akwa Ibom LGA clinics*

- **`TelehealthMeshSuite.tsx`** — Interactive mesh topology dashboard:
  - Live map of 6 LGA node topology with RSSI signal indicators
  - Per-node: status · queued bundles · vector clock version · sync timestamp
  - Peer Discovery button (simulates ad-hoc Wi-Fi RSSI scan)
  - DTN Bundle Broadcast (creates SHA-256-checksummed data packet)
  - Satellite Uplink Sync (drains queues → generates Merkle root)
  - Blackout Simulation (switches all nodes to store-and-forward)
  - Packet log with full audit trail

- **`telehealthMeshSync.ts`** — DTN engine library:
  - `loadMeshState()` → 6-node Akwa Ibom mesh topology
  - `triggerPeerDiscovery(mesh)` → updates RSSI values for all nodes
  - `broadcastDtnPacket(mesh, nodeId, type, payload)` → creates bundle, advances vector clock
  - `syncViaSatelliteUplink(mesh)` → flushes queues, computes Merkle root
  - `toggleBlackoutSimulation(mesh)` → switches operational profile
  - Full TypeScript interfaces: `MeshNode`, `DtnPacket`, `SatelliteLink`, `TelehealthMeshState`

- **6 mesh nodes:**
  1. Essien Udim Cottage Hospital (RSSI −62 dBm)
  2. Eastern Obolo Primary HC (RSSI −74 dBm, very remote)
  3. Ini LGA Cottage Hospital (RSSI −68 dBm)
  4. Creek Boat Floating Clinic (RSSI −81 dBm, offline-first)
  5. Immanuel General Hospital (RSSI −58 dBm)
  6. State MoH Server — Uyo (hub node)

#### Supporting Features Delivered in v2.0

| Feature | Files | Description |
|---------|-------|-------------|
| **Rapid Nurse Triage (60-sec)** | `RapidNurseTriageIntake.tsx` | ESI scoring, AVPU, GCS, NEWS2 in 60 seconds flat |
| **AI Clinical Automations** | `ClinicalAiAutomationsSuite.tsx`, `clinicalAiAutomations.ts` | Ambient SOAP scribing, discharge prep, early warning, safety |
| **LAMIS & NDR Suite** | `LamisNdrSuite.tsx`, `lamisStore.ts` | HIV clinic, PEPFAR RADET, NDR reporting, e-CRVS |
| **Discharge Summary Panel** | `MyDischargeSummaryPanel.tsx` (care app) | AI-generated discharge summaries in MedCore Care |
| **Sneakernet USB Offline** | `sneakernet.ts` | Encrypted USB data export/import for zero-connectivity sites |
| **Offline Verification Dashboard** | `ClinicalVerificationDashboard.tsx` | Conflict resolution UI for merged offline records |
| **eCRVS Integration** | `ecrvsService.ts` | Birth/death registration (NCRS + DHIS2) |

### 🔧 Changes & Improvements

- **`moduleRegistry.tsx`** — Registered 4 new modules:
  - `rapid-triage` → `RapidNurseTriageIntake`
  - `clinical-search` → `ClinicalGoogleSearchSuite`
  - `satellite-mesh` → `TelehealthMeshSuite`
  - `ai-automations` → `ClinicalAiAutomationsSuite`

- **`roleNav.tsx`** — Clinical Google surfaced in role-scoped nav:
  - Doctor sidebar: "Clinical Google (Ask File)" with GenAI badge
  - All-roles master directory: pillar 1 "Clinical Tools" section

- **`RapidNurseTriageIntake.tsx`** — Fixed VitalsRecord type compatibility:
  - `bpSystolic` / `bpDiastolic` now parsed to `number | undefined` (was `string | number`)

- **`NursingTriageStation.tsx`** — Minor UI fixes to triage station layout

### ✅ Test Results

```
scratch/verify_features.ts — 9/9 assertions passed (100%)

✅ Clinical Google — Peak creatinine 186 µmol/L found
✅ Clinical Google — 4 citations returned with exact sources
✅ Clinical Google — Action hooks: SOAP Note | Order STAT | Audit Regimen
✅ Clinical Google — Obstetric BP trajectory: 152/98 mmHg + 420mg/24h
✅ Mesh — 6 LGA nodes loaded (Essien Udim, Eastern Obolo, Ini, Creek Boat, Immanuel, State MoH)
✅ Mesh — Peer discovery: Essien Udim RSSI −62 dBm
✅ Mesh — DTN bundle DTN-PKT-8372 [TRIAGE_VITALS] + vector clock v49
✅ Mesh — Satellite uplink flush: queue = 0, Merkle root 0x83c7b4bda33b9f24
✅ Mesh — Blackout → store-and-forward → restored
```

**TypeScript:** `apps/os` ✅ 0 errors · `apps/care` ✅ 0 errors

---

## v1.5.0 — September 2026 · *"AkwaState"*

### New Features
- **AkwaIbomStateSuite** — State readiness scorecard, UPI barcode generation, AKSHIA enrollment
- **StatewideEmrSuite** — Hospital-to-hospital EMR completeness dashboard
- **LamisNdrSuite** (v1) — Basic HIV patient list and NDR submission
- **ClinicalSafetyBcpSuite** — Business continuity and consent management
- **DeviceGatewaySettings** — HL7/DICOM device hub configuration (Orthanc integration)
- **FhirHl7GatewaySuite** — Full FHIR R4 browser + HL7 v2 message log
- **AkwaRemitRevenueSuite** — State revenue collection and remittance hub
- **WorkflowIntelligenceHub** — AI-assisted patient journey optimisation
- **ClinicalUxSuite** — Unified outpatient UX (schedule, meds, notes, discharge)
- **Patient360View** — Longitudinal 360° patient profile

### Changes
- Role nav expanded to 15 distinct role profiles
- RBAC clearance levels L1–L5 enforced across all modules
- HMO claims now supports ICD-10 + CPT code submission
- Paystack POS integration for cashier tills

---

## v1.4.0 — August 2026 · *"ClinicalCore"*

### New Features
- Emergency & A&E Triage Suite (ESI scoring)
- Pharmacy Dispensing Suite (CPOE integration)
- Laboratory LIS Suite (result entry + LIVE alerts)
- Radiology & PACS Suite (DICOM viewer via Orthanc)
- Operating Theatre Suite (WHO checklist + operative notes)
- ICU & Critical Care Suite (telemetry, SOFA score, ventilator)
- Maternity & O&G Suite (ANC, partograph, CTG)
- Paediatrics & NICU Suite (incubator grid, newborn encounter)
- Blood Bank Suite (crossmatch, transfusion record)
- Inpatient Nursing Suite (e-MAR, fluid balance, kardex)
- HIM Health Records Suite (deficiency, coding, ROI, chart merge)

---

## v1.3.0 — July 2026 · *"Operations"*

### New Features
- Universal Queue Board (multi-department, priority ordering)
- Bed Management (real-time bed map, admit/transfer/discharge)
- Patient Flow Visibility (Sankey journey tracker, ALOS)
- Ambulance Fleet & Transfers (GPS dispatch, ETA countdown)
- Supply Chain Inventory (CMS, FIFO expiry alerts)
- Biomedical Equipment (fault log, service calendar)
- Facilities & Utilities (O₂ pressure, generator, water tank)
- Environmental Health & Safety (waste log, pest control, infection audit)
- Staffing Overview (duty roster, shift gaps, on-call)
- Notification Centre (in-basket with taxonomy)

---

## v1.2.0 — June 2026 · *"Finance"*

### New Features
- Billing & Invoicing Suite (auto-bill from encounter)
- Cashier POS Shift Tills (Paystack integration)
- Insurance & HMO Claims (AKSHIA + NHIA adjudication)
- Revenue Cycle & Accounting (AR desk, ledger management)
- Procurement & HR Suite (purchase orders, payroll)

---

## v1.1.0 — May 2026 · *"Intelligence"*

### New Features
- Celestia M87 AI Copilot (streaming, context-aware)
- AI Command Insights (decision support, predictive alerts)
- Integrated Data Hub (telemetry aggregation)
- Performance Analytics (KPI dashboard, CSV export)

---

## v1.0.0 — April 2026 · *"Foundation"*

### Initial Release
- Role-based authentication (15 role profiles)
- Hospital Onboarding Wizard (6-step setup)
- Command Centre Dashboard (real-time HUD)
- EMR & Intelligent Records (patient chart, SOAP)
- Doctor Portal (OPD consultation workflow)
- Digital Patient Card (FHIR R4 health card)
- RBAC & Access Control
- System Administration
- WebSocket LIVE event bus
- Role-scoped sidebar navigation

---

*MedCore OS Changelog · Powered by M87 · Akwa Ibom State Health Systems*
