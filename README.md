# MedCore Platform (Powered by M87)

> **MedCore** is an integrated next-generation healthcare ecosystem unifying patient engagement, clinical operations, hospital command & control, and nationwide public health surveillance.

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
