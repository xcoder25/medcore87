# MedCore OS — Technical Architecture & Developer Documentation
**Version 2.0 · October 2026**

---

## 1. System Overview

MedCore OS is the hospital command-and-control layer of the MedCore Platform — a Next.js 15 (App Router) web application designed for Nigerian tertiary health institutions, initially deployed for **Akwa Ibom State** hospitals. It unifies clinical, operational, financial, and interoperability workflows in a single authenticated shell with role-based access control.

### Platform Architecture

```
                     ┌────────────────────────────────────────┐
                     │       Central Data Hub & Event Bus     │
                     │        (MedCore M87 Core Engine)       │
                     │  WebSocket · REST · Firebase Realtime  │
                     └─────────────────┬──────────────────────┘
                                       │
       ┌────────────┬──────────────────┼──────────────────┬────────────┐
       ▼            ▼                  ▼                  ▼            ▼
  MedCore       MedCore            MedCore OS         MedCore       MedCore
   Care          Clinic           (this app)           Admin         API
 (Patient)      (Staff)       Desktop Command        (MOH/MoH)    (Backend)
 React Native  React Native     Centre · Next.js     Next.js 15    Node.js
   / Expo        / Expo         15 · Port 3003       Port 3004    Port 4000
```

---

## 2. Repository Structure

```
medcore/
├── apps/
│   ├── os/                         ← MedCore OS (this app)
│   │   ├── src/
│   │   │   ├── app/                ← Next.js App Router (page.tsx shell)
│   │   │   ├── components/         ← 37 feature component subdirectories
│   │   │   │   ├── ai-insights/    ← Celestia AI, Clinical Google, Automations
│   │   │   │   ├── clinical-core/  ← Emergency, Nursing, Triage, Theatre, ICU…
│   │   │   │   ├── dashboards/     ← RoleDashboard, DoctorPortal, CommandCentre
│   │   │   │   ├── finance/        ← Billing, Claims, AkwaRemit, Revenue
│   │   │   │   ├── interop/        ← FHIR, HL7, LAMIS, TelehealthMesh, AKS State
│   │   │   │   ├── operations/     ← Ambulance, Inventory, Facilities, Biomedical
│   │   │   │   ├── sync/           ← ClinicalVerificationDashboard (offline)
│   │   │   │   └── …(30 more)
│   │   │   ├── lib/                ← 113 TypeScript service/store modules
│   │   │   └── os/                 ← moduleRegistry.tsx · roleNav.tsx
│   │   ├── scratch/                ← Automated verification scripts
│   │   └── package.json
│   ├── care/                       ← Patient mobile app (React Native)
│   ├── clinic/                     ← Clinician mobile app (React Native)
│   └── admin/                      ← Ministry of Health portal (Next.js)
├── packages/
│   ├── ui/                         ← M87 Healthcare Design System
│   ├── types/                      ← Shared FHIR R4 + MOH TypeScript models
│   └── api-client/                 ← Shared SDK + WebSocket clients
├── services/
│   └── api-server/                 ← Central Event Gateway (Node.js / Express)
├── docs/                           ← This documentation
│   ├── TESTER_MANUAL.md
│   ├── ARCHITECTURE.md             ← This file
│   ├── DEVELOPER_GUIDE.md
│   ├── API_REFERENCE.md
│   └── architecture/
│       ├── SYSTEM_OVERVIEW.md
│       ├── NDHA_COMPLIANCE.md
│       └── MOH_ADMIN_ARCHITECTURE.md
└── README.md
```

---

## 3. Module Registry System

All 40+ clinical modules are lazy-loaded via `next/dynamic` from a central registry:

**File:** `apps/os/src/os/moduleRegistry.tsx`

```typescript
// Pattern: each module is a separate webpack chunk
export const ClinicalGoogleSearchSuite = dynamic(
  () => import('../components/ai-insights/ClinicalGoogleSearchSuite')
       .then(m => m.ClinicalGoogleSearchSuite),
  { loading: () => <ModulePageLoader label="Opening Clinical Google Search…" /> }
);
```

### ModuleKey Type
All valid navigation keys are declared in the `ModuleKey` union type. Adding a new module requires:
1. Add the dynamic import export
2. Add the key to `ModuleKey`
3. Add the component mapping to `MODULE_COMPONENTS`
4. Add the clearance level to `MODULE_CLEARANCE`
5. Add the nav item to `roleNav.tsx`

### Access Control (MODULE_CLEARANCE)
```typescript
export const MODULE_CLEARANCE: Record<ModuleKey, { level: number; label: string; roleDesc: string }> = {
  'clinical-search': { level: 2, label: 'L2 Clinical', roleDesc: 'Clinical Google EMR Search' },
  'satellite-mesh':  { level: 3, label: 'L3 Operations', roleDesc: 'Telehealth Mesh & Satellite' },
  auth:              { level: 5, label: 'L5 Executive', roleDesc: 'Hospital IAM Administrator' },
  // … 40+ entries
};
```

---

## 4. The 7-Pillar Hospital Blueprint

MedCore OS is organized around 7 clinical/operational pillars:

| Pillar | Modules | Description |
|--------|---------|-------------|
| **1. AI & Intelligence** | Celestia M87 · Clinical Google · AI Automations | Generative AI, ambient scribing, early warning |
| **2. Core Clinical Suites** | EMR · A&E · Theatre · ICU · Pharmacy · Lab · Radiology · Maternity · Paediatrics · Blood Bank · Nursing · Triage | Hospital specialty clinical workflows |
| **3. Operations & Logistics** | Command Centre · Beds · Patient Flow · Queue · Staffing · Ambulance · Inventory · Biomedical · Facilities · Environmental | Hospital operations management |
| **4. Finance & Revenue** | Billing · Cashier · AkwaRemit · Claims · Revenue Cycle · Procurement | Financial management, NHIA, HMO |
| **5. Data & Interoperability** | AKSHIA State · LAMIS/NDR · Data Hub · FHIR · Analytics · Offline Sync · Telehealth Mesh | Interoperability, surveillance, offline |
| **6. Connected IoT** | IoT Devices · Device Gateway | Medical device integration |
| **7. Governance & Security** | Auth · Facility · RBAC · Compliance · Safety · System Admin | Access control, audit, compliance |

---

## 5. Key Library Modules (`apps/os/src/lib/`)

### AI & Clinical Intelligence
| File | Purpose |
|------|---------|
| `clinicalGoogleSearch.ts` | Generative AI patient dossier query engine; NLP synthesis with exact citations |
| `clinicalAiAutomations.ts` | Ambient SOAP scribing, discharge prep, NEWS2 early warning engine |
| `clinicalIntelligenceEngine.ts` | Predictive deterioration, AVPU/GCS/ESI scoring algorithms |
| `clinicalEarlyWarning.ts` | NEWS2 score calculator with threshold alerting |
| `m87LearningStore.ts` | Celestia AI model state + conversation history |
| `geminiClient.ts` | Google Gemini API integration layer |
| `medgemmaClient.ts` | MedGemma medical AI model integration |

### Interoperability & Sync
| File | Purpose |
|------|---------|
| `telehealthMeshSync.ts` | DTN peer discovery, vector clocks, Merkle-root satellite uplink |
| `sneakernet.ts` | Encrypted USB offline data export/import |
| `deltaSyncEngine.ts` | CRDTs + delta sync for multi-device offline merging |
| `fhirStub.ts` | FHIR R4 resource builder (Patient, Encounter, Observation) |
| `lamisStore.ts` | LAMIS HIV clinic + PEPFAR RADET data model |
| `ecrvsService.ts` | e-CRVS birth/death registration (NCRS integration) |
| `dhis2Export.ts` | DHIS2 NHMIS tracker event export |
| `akshiaGateway.ts` | AKSHIA state health insurance eligibility + claims |

### Financial
| File | Purpose |
|------|---------|
| `patientBillingStore.ts` | Encounter billing engine; HMO deduction logic |
| `akwaRemitStore.ts` | State revenue collection, reconciliation, remittance |
| `paymentReceiptModule.ts` | Receipt generation (POS, bank transfer, AKSHIA) |
| `paystackClient.ts` | Paystack payment gateway SDK wrapper |
| `arDeskStore.ts` | Accounts Receivable ledger management |

### Clinical Operations
| File | Purpose |
|------|---------|
| `nursingVitalsStore.ts` | Vitals recording, NEWS2 calculation, triage queue |
| `bedBoardStore.ts` | Real-time bed occupancy, ward census, transfer logic |
| `opdFlowOrchestrator.ts` | OPD patient flow state machine (Registration → Discharge) |
| `universalQueue.ts` | Multi-department queue management with priority ordering |
| `notificationEngine.ts` | In-basket alerts: lab criticals, pharmacy, system events |
| `staffCardStore.ts` | 77 KB staff identity, role inference, biometric data model |
| `rolePermissionsStore.ts` | RBAC permission matrix per role key |

### Offline & Resilience
| File | Purpose |
|------|---------|
| `durableOutbox.ts` | Guaranteed delivery outbox for offline mutations |
| `connectivityCircuitBreaker.ts` | Network health detection, automatic fallback modes |
| `offlineCdsEngine.ts` | Offline clinical decision support (drug checks, protocols) |
| `idb.ts` | IndexedDB abstraction layer for offline storage |

---

## 6. Role Navigation System

**File:** `apps/os/src/os/roleNav.tsx`

The `getRoleNavSections(session, showFullDirectory)` function returns role-specific sidebar sections:

```typescript
export function getRoleNavSections(session: UserSession | null, showFullDirectory: boolean): NavSection[] {
  if (showFullDirectory || !session) return [{ label: 'My workspace', ... }, ...MASTER_PILLARS];
  const roleKey = inferRoleKey(session.roleKey || session.role);
  switch (roleKey) {
    case 'doctor':   return [...doctorSections];
    case 'nurse':    return [...nurseSections];
    case 'surgeon':  return [...surgeonSections];
    // … 15+ role cases
  }
}
```

**Supported role keys:** `doctor` · `surgeon` · `nurse` · `midwife` · `pharmacist` · `lab` · `records` · `reception` · `cashier` · `accountant` · `admin` · `ict` · `biomedical` · `storekeeper` · `moh`

---

## 7. Generative AI — Clinical Google Search

**Files:** `src/lib/clinicalGoogleSearch.ts` · `src/components/ai-insights/ClinicalGoogleSearchSuite.tsx`

### Architecture
```
User query (natural language)
        │
        ▼
  queryClassifier()         ← detects intent: lab/medication/procedure/allergy/notes
        │
        ▼
  searchPatientDossier()    ← scans CLINICAL_DOSSIERS in-memory store
        │
        ▼
  synthesizeAnswer()        ← generates narrative summary + ranked citations
        │
        ▼
  ClinicalSearchAnswer {
    summary: string,
    citations: PatientCitation[],
    keyMetrics: MetricCard[],
    actionHooks: ActionHook[]
  }
```

### PatientDossier Schema
```typescript
interface PatientDossier {
  patientId: string;
  fullName: string;
  age: number;
  bloodGroup: string;
  allergies: string[];
  conditions: string[];
  labHistory: LabRecord[];       // Creatinine, eGFR, FBC, LFT…
  medicationHistory: MedRecord[]; // Drug, dose, start/stop dates
  clinicalNotes: NoteRecord[];    // SOAP / discharge / referral notes
  procedures: ProcedureRecord[];
}
```

---

## 8. Telehealth Mesh & DTN Infrastructure

**Files:** `src/lib/telehealthMeshSync.ts` · `src/components/interop/TelehealthMeshSuite.tsx`

### Mesh Topology (Akwa Ibom LGAs)
```
State MoH Server (Uyo) ←── Satellite Uplink ──→ Internet / DHIS2 / NDR
        │
        ├── Immanuel General Hospital (Eket) — RSSI −58 dBm
        ├── Essien Udim Cottage Hospital    — RSSI −62 dBm  [Remote]
        ├── Eastern Obolo Primary HC        — RSSI −74 dBm  [Very Remote]
        ├── Ini LGA Cottage Hospital        — RSSI −68 dBm
        └── Creek Boat Floating Clinic      — RSSI −81 dBm  [Offline-first]
```

### Operational Profiles
| Profile | Description | Behaviour |
|---------|-------------|-----------|
| `CLOUD_ONLINE` | Full internet + satellite | Sync immediately to cloud |
| `LAN_ONLY` | Local Wi-Fi mesh, no internet | P2P DTN broadcast; queue for uplink |
| `BLACKOUT` | Complete offline | Store-and-forward only; Sneakernet USB |

### DTN Packet Structure
```typescript
interface DtnPacket {
  bundleId: string;           // e.g. "DTN-PKT-8372"
  originLga: string;          // "Essien Udim"
  payloadType: 'TRIAGE_VITALS' | 'LAB_RESULT' | 'PRESCRIPTION' | 'PATIENT_REG';
  payload: string;            // Encrypted JSON payload
  checksumSha256: string;     // Integrity verification
  createdAt: string;
  delivered: boolean;
}
```

### Vector Clock Synchronization
Each node maintains a Lamport-style monotonic `vectorClock`. On broadcast, the originating node increments; on merge, receiving nodes take `max(local, remote)`. The satellite uplink produces a **Merkle tree root** over all delivered bundle checksums, providing cryptographic proof of sync completeness.

---

## 9. Offline & Resilience Architecture

```
┌─────────────────────────────────────────────────────┐
│                   MedCore OS Client                 │
│                                                     │
│  UI Layer ──→ Durable Outbox ──→ Delta Sync Engine │
│                    │                    │           │
│               IndexedDB           Conflict CRDT     │
│                    │                    │           │
│              ConnectivityCircuitBreaker             │
│               /           \                         │
│         CLOUD_ONLINE    LAN_ONLY / BLACKOUT          │
│              │               │                      │
│         Firebase/PG      P2P Mesh / USB             │
└─────────────────────────────────────────────────────┘
```

**Key principles:**
- **Optimistic UI**: All writes succeed locally first; sync happens asynchronously
- **Conflict resolution**: Last-write-wins by default; clinical records require manual resolution
- **Durable Outbox**: All mutations queued in `durableOutbox.ts` — survives browser refresh
- **Circuit Breaker**: After 3 consecutive failures, `connectivityCircuitBreaker.ts` switches to offline mode automatically

---

## 10. FHIR R4 & Interoperability

MedCore OS implements FHIR R4 resource generation for:

| Resource | Usage |
|----------|-------|
| `Patient` | Patient registration, UPI linkage |
| `Encounter` | OPD/Inpatient visits |
| `Observation` | Vitals, lab results |
| `MedicationRequest` | e-Prescriptions (CPOE) |
| `Condition` | Problem list (ICD-10) |
| `Procedure` | Theatre operations, procedures |
| `DiagnosticReport` | Lab reports, radiology reports |

**HL7 v2.x Message Types Supported:**
- `ADT^A01` — Patient Admit
- `ADT^A08` — Patient Update
- `ADT^A03` — Patient Discharge
- `ORU^R01` — Lab Result
- `RDE^O11` — Pharmacy Order

---

## 11. State Management Patterns

MedCore OS uses a **Zustand + localStorage/IndexedDB hybrid** pattern:

```typescript
// Pattern: Zustand store with persistence
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useBedBoardStore = create(persist(
  (set, get) => ({
    beds: [] as BedRecord[],
    admitPatient: (bedId, patient) => set(state => ({
      beds: state.beds.map(b => b.id === bedId ? { ...b, patient, status: 'OCCUPIED' } : b)
    })),
  }),
  { name: 'medcore-bed-board' }
));
```

**Event-driven updates** from the API use the `clinicalEventBus.ts` pub/sub system to push real-time changes to Zustand stores without polling.

---

## 12. TypeScript Build & Quality

```bash
# Type-check both applications
cd apps/os && npx tsc --noEmit    # Must exit 0
cd apps/care && npx tsc --noEmit  # Must exit 0

# Run automated feature tests
cd apps/os && npx tsx scratch/verify_features.ts

# Run AI verification suite
cd apps/os && npx tsx scratch/verify_ai.ts
```

**Current status (commit 5e45782):**
- `apps/os` TypeScript: ✅ 0 errors
- `apps/care` TypeScript: ✅ 0 errors
- `verify_features.ts`: ✅ 9/9 tests passing
- Total codebase: ~450,000 bytes of application code

---

## 13. Deployment

### Docker
```bash
docker build -t medcore-os .
docker run -p 3003:3003 -e NEXT_PUBLIC_WS_URL=ws://api:4000/ws medcore-os
```

### Railway / Fly.io
Configuration files: `railway.toml`, `fly.toml` — deploy with:
```bash
railway up        # Railway deployment
flyctl deploy     # Fly.io deployment
```

### Firebase (Static hosting)
```bash
npm run build --workspace=apps/os
firebase deploy --only hosting
```

### Environment Variables (Production)
```bash
NEXT_PUBLIC_WS_URL=wss://api.medcore.gov.ng/ws
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
PAYSTACK_SECRET_KEY=...
TERMII_API_KEY=...
DHIS2_BASE_URL=https://dhis2.health.gov.ng
ORTHANC_URL=http://pacs.hospital.local:8042
```

---

*MedCore OS Architecture Documentation v2.0 · October 2026*
*Powered by M87 · Akwa Ibom State Health Systems*
