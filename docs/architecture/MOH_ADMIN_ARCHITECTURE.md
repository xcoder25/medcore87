# MedCore Admin: Ministry of Health (MOH) Portal Architecture

> The **MedCore Admin** web portal provides national and regional healthcare authorities with real-time surveillance, capacity intelligence, and regulatory oversight across all registered health facilities.

---

## 1. Core Objectives
1. **National Capacity Orchestration**: Real-time visibility into bed occupancy, ICU surge, and ventilator availability across regional networks.
2. **Disease & Epidemic Surveillance**: Automated cluster and outbreak alerts triggered by clinical diagnosis spikes (ICD-10/SNOMED).
3. **Institutional Licensing & Accreditation**: Verification of hospital tier licenses, facility inspection scores, and compliance mandates.
4. **Clinical Workforce Intelligence**: Telemetry on doctor/nurse-to-patient ratios, specialty coverage, and clinician licensing.
5. **Auditing & Regulatory Directives**: Broadcast of emergency health protocols and tracking of hospital remediation compliance.

---

## 2. Technology Specifications
* **Framework**: **Next.js 15 (App Router)**
* **Rendering Strategy**: Hybrid SSR (Server-Side Rendering) for real-time dashboard data + Client-Side streaming for low-latency updates.
* **Port**: Default `3004`
* **Security & Access**: Zero-Trust Government / MOH RBAC, multi-factor authentication (MFA), role separation (National Director, Regional Inspector, Epidemiologist, Regulatory Auditor).

---

## 3. Data Integration with MedCore OS and Clinic
```
[ MedCore Clinic (Staff Mobile) ] ───▶ [ Hospital Local OS (Next.js) ]
                                                   │
                                                   ▼ (De-identified Aggregate Telemetry)
                                        [ Central Data Hub API ]
                                                   │
                                                   ▼ (Secure Regulatory Channel)
                                    [ MedCore Admin - MOH Portal (Next.js) ]
```

- **De-identification**: Individual patient identifying data (PII) is scrubbed at the hospital boundary in accordance with national health privacy laws (HIPAA/GDPR compliant).
- **Near Real-time Aggregation**: Aggregate census, mortality, communicable disease reports, and wait times stream into the MOH data lake via WebSockets/SSE.
