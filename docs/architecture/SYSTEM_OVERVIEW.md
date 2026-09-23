# MedCore Platform Architecture (Powered by M87)

## Architectural Principles & Tier Separation

The MedCore healthcare ecosystem is divided across two distinct client tiers to optimize user experience, performance, and security:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                        MedCore Ecosystem Client Tier                             │
├─────────────────────────────────────────┬────────────────────────────────────────┤
│           Mobile Client Tier            │         Enterprise Web Client Tier     │
│         (React Native / Expo)           │            (Next.js 15 SSR)            │
├───────────────────┬─────────────────────┼───────────────────┬────────────────────┤
│   MedCore Care    │   MedCore Clinic    │    MedCore OS     │   MedCore Admin    │
│   (Patient App)   │     (Staff App)     │  (Command Centre) │    (MOH Portal)    │
│                   │                     │                   │                    │
│ • Patient front   │ • Bedside nursing   │ • Live bed        │ • National health  │
│   door            │   rounds            │   telemetry       │   surveillance     │
│ • Labs & records  │ • SBAR handovers    │ • Surge tracking  │ • Outbreak alerts  │
│ • Tourism desk    │ • Barcode scanning  │ • Patient transit │ • Facility audit   │
│ • Telemedicine    │ • M87 AI ambient    │ • Audit logs      │ • Regulatory data  │
└─────────┬─────────┴──────────┬──────────┴─────────┬─────────┴─────────┬──────────┘
          │                    │                    │                   │
          ▼                    ▼                    ▼                   ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                  Central MedCore Data Hub (FHIR R4 & Event Bus)                  │
│                        Node.js / Express / WebSockets                            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 1. Mobile Client Tier (React Native / Expo)
- **`MedCore Care`**: Zero-trust, patient-facing native mobile app on iOS & Android. Optimized for biometrics, push notifications, offline health summaries, multi-language localization, and concierge services.
- **`MedCore Clinic`**: High-availability clinical bedside mobile app. Optimized for on-duty doctors and nurses, quick vitals logging, camera barcode scanning for medications, offline-tolerant data cache, and M87 voice capture.

### 2. Enterprise Web Client Tier (Next.js 15 App Router)
- **`MedCore OS`**: Desktop-first hospital command centre HUD. Utilizes Next.js Server Components, real-time WebSocket streaming, high-density charts, and instant operational actioning.
- **`MedCore Admin`**: Ministry of Health (MOH) and regulatory oversight portal. Provides cross-institutional aggregated surveillance, epidemiological early warnings, hospital accreditation compliance, and macro-level health metrics.

### 3. Single Source of Truth & Interoperability
- All applications communicate with the **MedCore Central Data Hub**.
- FHIR R4 standard-aligned resources (`Patient`, `Encounter`, `Observation`, `Condition`, `Appointment`, `AuditEvent`) maintain compliance with HL7/FHIR international standards.
- Real-time event bus distributes low-latency events: bed occupancy changes, deteriorating patient early warning score triggers (NEWS2), and STAT orders.

### 4. Powered by M87 AI
- **Ambient Clinical Intelligence**: Ambient transcription of clinical consultations into structured SOAP notes.
- **Predictive Operations**: Capacity and bed bottlenecks forecasting 6 to 24 hours in advance.
- **Epidemiological Anomaly Detection**: Automatic cluster detection across regional hospitals reporting to the MOH portal.
