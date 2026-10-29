# MedCore OS — API Reference
**Version 2.0 · October 2026**

> REST + WebSocket API reference for the MedCore Central Data Hub (`services/api-server`).
> Base URL (local): `http://localhost:4000` · Base URL (production): `https://api.medcore.gov.ng`

---

## Authentication

All API requests (except health check) require a `facilityId` in the request body.
Future versions will require Bearer token authentication.

---

## Health Check

### `GET /`
Returns server status.

**Response `200`:**
```json
{ "status": "ok", "version": "2.0.0", "uptime": 3600 }
```

---

## Lab Results

### `POST /api/v1/lab/results`
Push a verified lab result to the event bus. Triggers real-time notification on all connected OS sessions for the matching facility.

**Request body:**
```json
{
  "patientId":   "PAT-1",
  "patientName": "Uduak Essen",
  "facilityId":  "AKS-IBOM-SPECIALIST",
  "testName":    "Troponin I",
  "results": [
    {
      "parameter":     "Troponin I",
      "value":         "2.1",
      "unit":          "ng/mL",
      "referenceRange":"< 0.04",
      "flag":          "CRITICAL"
    }
  ],
  "verifiedBy": "E. Nwosu MLS"
}
```

**Response `200`:**
```json
{ "published": true, "eventId": "evt-1234567890" }
```

**Effect:** All WebSocket clients with matching `facilityId` receive:
```json
{
  "type": "LAB_CRITICAL",
  "patientId": "PAT-1",
  "patientName": "Uduak Essen",
  "testName": "Troponin I",
  "value": "2.1 ng/mL",
  "flag": "CRITICAL"
}
```

---

## CPOE — Order Sets

### `POST /api/v1/cpoe/order-sets/apply`
Apply a clinical order set to a patient encounter.

**Request body:**
```json
{
  "patientId":   "PAT-1",
  "facilityId":  "AKS-IBOM-SPECIALIST",
  "encounterId": "ENC-2026-001",
  "orderSetId":  "sepsis-bundle-6h",
  "orderedBy":   "Dr. A. Bello"
}
```

**Response `200`:**
```json
{
  "applied": true,
  "ordersCreated": ["lab-fbc", "lab-blood-culture", "rx-ceftriaxone-2g-iv", "iv-fluid-ns-1l"]
}
```

---

## Pharmacy

### `POST /api/v1/pharmacy/stock/deplete`
Record medication dispensing (decrements stock level).

**Request body:**
```json
{
  "drugId":       "amoxicillin-500",
  "facilityId":   "AKS-IBOM-SPECIALIST",
  "quantityUsed": 50
}
```

**Response `200`:**
```json
{ "currentStock": 450, "minimumLevel": 500, "stockAlert": true }
```

---

## HMO / AKSHIA Eligibility

### `POST /api/v1/hmo/eligibility`
Check patient HMO/AKSHIA insurance eligibility.

**Request body:**
```json
{
  "policyId":   "AKSHIA-POL-88201",
  "facilityId": "AKS-IBOM-SPECIALIST"
}
```

**Response `200` — Eligible:**
```json
{
  "eligible":  true,
  "plan":      "Comprehensive",
  "copayPct":  0,
  "coverageItems": ["outpatient", "inpatient", "surgery", "maternity", "lab"]
}
```

**Response `200` — Not eligible:**
```json
{
  "eligible": false,
  "reason":   "Policy expired"
}
```

### Demo Policy IDs
| Policy ID | Result |
|-----------|--------|
| `AKSHIA-POL-88201` | Eligible, Comprehensive, 0% copay |
| `AKSHIA-POL-39102` | Eligible, Basic, 20% copay |
| `NHIA-VULN-00412` | Eligible, Vulnerable, 0% copay |
| `AKSHIA-POL-EXPIRED` | Not eligible — expired |
| `NHIA-INVALID-999` | Not eligible — not found |

---

## Communications (SMS / USSD)

### `POST /api/v1/comms/sms/send`
Send an SMS to a patient or staff member.

**Request body:**
```json
{
  "to":         "+2348012345678",
  "message":    "Your appointment at Ibom Specialist Hospital is confirmed for 09:00 tomorrow.",
  "facilityId": "AKS-IBOM-SPECIALIST"
}
```

**Response `200`:**
```json
{ "sent": true, "messageId": "sms-9876543210", "provider": "Termii" }
```

> ⚠️ SMS is simulated unless `TERMII_API_KEY` is set.

### USSD Simulation
Dial `*384*48#` to trigger the USSD patient registration/query flow (simulator only).

---

## Admissions (ADT)

### `POST /api/v1/adt/admit`
Admit a patient to an inpatient bed.

**Request body:**
```json
{
  "patientId":   "PAT-1",
  "facilityId":  "AKS-IBOM-SPECIALIST",
  "wardId":      "WARD-GENERAL-A",
  "bedId":       "BED-A-04",
  "admittedBy":  "Dr. A. Bello",
  "diagnosis":   "Community Acquired Pneumonia",
  "icd10Code":   "J18.9"
}
```

**Response `200`:**
```json
{ "admissionId": "ADM-2026-1042", "admitted": true, "bedAssigned": "BED-A-04" }
```

### `POST /api/v1/adt/discharge`
Discharge a patient.

**Request body:**
```json
{
  "admissionId": "ADM-2026-1042",
  "facilityId":  "AKS-IBOM-SPECIALIST",
  "dischargedBy":"Dr. A. Bello",
  "dischargeType":"HOME",
  "followUpDate": "2026-11-12"
}
```

---

## WebSocket Events

Connect to: `ws://localhost:4000/ws`

### Subscribe to facility events
Send on connect:
```json
{ "action": "subscribe", "facilityId": "AKS-IBOM-SPECIALIST" }
```

### Inbound event types (server → client)

| Event Type | Trigger |
|-----------|---------|
| `LAB_CRITICAL` | Critical lab result posted |
| `LAB_RESULT_READY` | Normal lab result verified |
| `PRESCRIPTION_READY` | Doctor placed prescription |
| `DRUG_DISPENSED` | Pharmacist dispensed medication |
| `PATIENT_ADMITTED` | ADT admit event |
| `PATIENT_DISCHARGED` | ADT discharge event |
| `BED_STATUS_CHANGED` | Bed availability changed |
| `EMERGENCY_ALERT` | Code Blue / Code Red broadcast |
| `STAFF_SHIFT_START` | Shift roster event |
| `STOCK_ALERT` | Pharmacy stock below minimum |

**Example event payload:**
```json
{
  "type":        "LAB_CRITICAL",
  "eventId":     "evt-1234567890",
  "facilityId":  "AKS-IBOM-SPECIALIST",
  "patientId":   "PAT-1",
  "patientName": "Uduak Essen",
  "testName":    "Potassium",
  "value":       "6.8 mmol/L",
  "flag":        "CRITICAL",
  "timestamp":   "2026-10-29T13:45:00Z"
}
```

---

## DHIS2 / NHMIS

### `POST /api/v1/dhis2/push-trackers`
Push tracker program events to DHIS2.

**Request body:**
```json
{
  "facilityOrgUnit": "gD7TowwI46c",
  "program":         "lxAQ7Zs9VYR",
  "events": [
    {
      "trackedEntityInstance": "ENRjVGxVTo6",
      "programStage": "A03MvHHogjR",
      "dataValues": [
        { "dataElement": "qrur9Dvnyt5", "value": "160" },
        { "dataElement": "oZg33kd9taw", "value": "100" }
      ]
    }
  ]
}
```

---

## Error Responses

All errors follow the format:
```json
{
  "error":   true,
  "code":    "FACILITY_NOT_FOUND",
  "message": "No facility with id AKS-INVALID found",
  "status":  404
}
```

### Standard Error Codes
| Code | HTTP | Meaning |
|------|------|---------|
| `FACILITY_NOT_FOUND` | 404 | facilityId does not exist |
| `PATIENT_NOT_FOUND` | 404 | patientId does not exist |
| `POLICY_EXPIRED` | 200 | HMO policy expired (eligible=false) |
| `POLICY_NOT_FOUND` | 200 | HMO policy not in system |
| `VALIDATION_ERROR` | 400 | Missing required fields |
| `INTERNAL_ERROR` | 500 | Server-side error |

---

*MedCore API Reference v2.0 · October 2026 · Powered by M87*
