# MedCore Platform (Powered by M87)
**v2.0 · October 2026 · Akwa Ibom State Health Systems**

> **MedCore** is an integrated next-generation healthcare ecosystem unifying patient engagement, clinical operations, hospital command & control, and nationwide public health surveillance across all 31 Akwa Ibom State LGAs.

## 📚 Documentation

| Document | Description |
|---------|-------------|
| [TESTER_MANUAL.md](docs/TESTER_MANUAL.md) | QA & UAT tester manual — all 40 modules, journeys, acceptance criteria |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture, module registry, key libraries |
| [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | Developer onboarding, adding modules, writing stores |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | REST + WebSocket API reference with curl examples |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | LAN · Docker · Railway · Fly.io deployment guides |
| [CHANGELOG.md](docs/CHANGELOG.md) | Release notes v1.0 → v2.0 |
| [GO_LIVE.md](GO_LIVE.md) | Same-day hospital go-live runbook |

---

## ✨ What's New in v2.0 — *Celestia Mesh*

### 🔍 Generative AI "Clinical Google" Search
Replaces tedious menu-clicking with a natural language search bar:
- Doctors type *"Summarize this patient's hypertension medications and show me their highest creatinine level"*
- System synthesizes 5+ years of lab reports, clinic notes, and prescriptions in **< 0.5 seconds**
- Returns exact **cited** clinical sources, longitudinal metrics, and 1-click action hooks

### 📡 Smart Infrastructure & Telehealth Mesh (DTN)
Decentralized peer-to-peer data sync for remote LGA clinics:
- **6 mesh nodes** across Essien Udim, Eastern Obolo, Ini, Creek Boat Floating Clinic, Immanuel GH, State MoH
- **Delay-Tolerant Networking (DTN)** with SHA-256 bundle integrity and Lamport vector clocks
- **Opportunistic satellite uplink** with Merkle-root proof-of-sync
- **Full blackout mode** — store-and-forward with USB sneakernet fallback

### Other v2.0 Additions
- ⚡ **60-Second Rapid Nurse Triage** — AVPU, GCS, NEWS2, ESI routing in one form
- 🤖 **AI Clinical Automations** — Ambient SOAP scribing, discharge prep, early warning
- 🧬 **LAMIS & NDR Suite** — HIV clinic, PEPFAR RADET, NDR reporting, e-CRVS birth registration
- 🔌 **Offline Sync Dashboard** — Conflict resolution UI for multi-site merged records

---

## Ecosystem Architecture

The MedCore platform comprises four purpose-built applications operating over a shared intelligent data hub:

```
                         ┌─────────────────────────────────┐
                         │   Central Data Hub & Event Bus  │
                         │     (MedCore M87 Core Engine)   │
                         └────────────────┬────────────────┘
                                          │
       ┌───────────────────────┬──────────┴──────────┬───────────────────────┐
       │                       │                     │                       │
       ▼                       ▼                     ▼                       ▼
┌───────────────┐       ┌───────────────┐     ┌───────────────┐       ┌───────────────┐
│ MedCore Care  │       │MedCore Clinic │     │  MedCore OS   │       │ MedCore Admin │
│ (Patient App) │       │  (Staff App)  │     │(Command Cent.)│       │  (MOH Portal) │
│               │       │               │     │               │       │               │
│ 📱 Mobile     │       │ 📱 Mobile     │     │ 💻 Next.js    │       │ 💻 Next.js    │
│ React Native  │       │ React Native  │     │ App Router    │       │ App Router    │
│ / Expo        │       │ / Expo        │     │ (Port 3003)   │       │ (Port 3004)   │
└───────────────┘       └───────────────┘     └───────────────┘       └───────────────┘
```

---

## Application Breakdown

### 1. MedCore Care (`apps/care`)
* **Form Factor**: **Mobile App** (iOS & Android)
* **Framework**: **React Native / Expo**
* **Target Users**: Patients & Caregivers
* **Key Capabilities**:
  - **Smart Appointments**: Interactive booking, specialist matching, automated reminders.
  - **Results & Medical Records**: Diagnostic labs, radiology summaries, vaccination records.
  - **Care Navigation**: Contextual pre-visit prep instructions and post-discharge protocols.
  - **Medical Tourism Support**: Cross-border care concierge, flight & transfer bookings, interpreter coordination.
  - **Secure Messaging**: Encrypted patient-provider messaging and virtual consultations.
  - **Personal Health Profile**: Allergy tracking, chronic condition management, and emergency contacts.
  - **Multi-language Support**: Full i18n localization (English, Arabic, Spanish, French, etc.).

---

### 2. MedCore Clinic (`apps/clinic`)
* **Form Factor**: **Mobile App** (iOS & Android)
* **Framework**: **React Native / Expo**
* **Target Users**: Doctors, Nurses, and Bedside Clinical Staff
* **Key Capabilities**:
  - **Bedside Clinical Cockpit**: Real-time vitals recording, active medication review, problem lists.
  - **Intelligent Rostering & Shifts**: Shift swaps, coverage gap alerts, on-call directory.
  - **Task Checklist & Orders**: Phlebotomy, STAT lab orders, nursing care tasks with barcode scanning.
  - **Handover Notes & Protocols**: Standardized digital SBAR handovers between shift teams.
  - **Urgent Code Broadcasts**: Code Blue / Code Red emergency notifications and instant team chat.
  - **Ambient AI Doctor Assistant**: Mobile ambient voice recording with automated SOAP note generation.

---

### 3. MedCore OS (`apps/os`)
* **Form Factor**: **Desktop Web Application**
* **Framework**: **Next.js 15 (App Router)**
* **Target Users**: Hospital Administrators, Floor Managers, Operations Directors
* **Key Capabilities**:
  - **Real-time Command Centre HUD**: High-altitude operational metrics, census, and department throughput.
  - **Bed & Resource Telemetry**: Real-time bed occupancy, turnaround workflow, ICU and ventilator tracking.
  - **Patient Flow Visibility**: Journey tracker across Emergency triage, Operating Theatres, Wards, and Discharge.
  - **Workforce & Staffing Overview**: Live staff-to-patient ratios across departments and escalation management.
  - **Audit Logs & Compliance**: Tamper-evident PHI access logging with automated HIPAA/GDPR audit exports.
  - **M87 AI Surge Insights**: Predictive bed bottleneck forecasting and patient deterioration modeling.

---

### 4. MedCore Admin / Ministry of Health (`apps/admin`)
* **Form Factor**: **Desktop Web Application**
* **Framework**: **Next.js 15 (App Router)**
* **Target Users**: Ministry of Health (MOH) Officials, Public Health Regulators, Regional Directors
* **Key Capabilities**:
  - **National Facility Surveillance**: Nationwide and regional map of hospital capacity and utilization.
  - **Epidemiological Outbreak Tracking**: Early detection heatmaps, rate of increase, and containment status.
  - **Facility Licensing & Accreditation**: Hospital license expiration, inspection audit findings, and compliance scores.
  - **National Healthcare Workforce**: Aggregated clinician distribution, specialist shortages, and accreditation records.
  - **Regulatory Enforcement**: Formal inquiries, remediation plans, and regulatory directive broadcasts.

---

## Directory Architecture

```text
medcore/
├── apps/
│   ├── care/                  # Patient Mobile App (React Native / Expo)
│   ├── clinic/                # Clinician Mobile App (React Native / Expo)
│   ├── os/                    # Hospital Command Centre (Next.js 15)
│   └── admin/                 # Ministry of Health Portal (Next.js 15)
├── packages/
│   ├── ui/                    # M87 Healthcare Design System (tokens & reusable components)
│   ├── types/                 # Shared TypeScript domain models (FHIR R4 & MOH models)
│   └── api-client/            # Shared SDK & Real-time WebSocket clients
├── services/
│   └── api-server/            # Central Data Hub API & Real-time event gateway
├── docs/                      # Technical architecture, compliance, and clinical specs
├── package.json               # Monorepo workspace configuration
└── README.md
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Running Applications

#### Mobile Applications (Expo)
```bash
# MedCore Care (Patient Mobile App)
npm run dev:care

# MedCore Clinic (Staff Mobile App)
npm run dev:clinic
```

#### Enterprise Web Applications (Next.js)
```bash
# MedCore OS (Hospital Command Centre - http://localhost:3003)
npm run dev:os

# MedCore Admin (Ministry of Health Portal - http://localhost:3004)
npm run dev:admin
```

#### Central Backend Gateway
```bash
# MedCore API Server
npm run dev:server
```

---
© 2026 MedCore Health Systems. Powered by M87.
