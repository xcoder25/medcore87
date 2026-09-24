# MedCore — Hospital Go-Live Runbook (Ibom / Akwa Ibom)

**Branch:** `master` · **Target:** same-day hospital use

---

## 1. Start the platform (two terminals recommended)

### Terminal A — API + WebSocket (required for LIVE alerts)

```bash
cd medcore87   # or your clone path
cd services/api-server
npm install
npm run dev
```

Confirm:
- http://localhost:4000/
- ws://localhost:4000/ws

### Terminal B — Hospital OS (desktop UI)

```bash
cd medcore87/apps/os
npm install
npm run dev
```

Open the URL printed by Next (often http://localhost:3000 or 3003).

**Optional one-shot gateway** (static + limited API):

```bash
./start.sh
```

Prefer Terminal A + B for full clinical loop + LIVE bell.

---

## 2. Demo logins

| Role | Email | Password |
|------|--------|----------|
| Doctor | a.bello@ibomspecialist.gov.ng | doctor123 |
| Nurse | c.okeke@ibomspecialist.gov.ng | nurse123 |
| Pharmacist | i.musa@ibomspecialist.gov.ng | pharm123 |
| Lab | e.nwosu@ibomspecialist.gov.ng | lab123 |
| Reception | f.adeyemi@ibomspecialist.gov.ng | reception123 |
| Admin | c.okoro@ibomspecialist.gov.ng | admin123 |

---

## 3. What works live today

| Capability | How to use |
|------------|------------|
| **LIVE top bar** | Green LIVE when API WebSocket is up; bell for lab/Rx/alerts |
| **Command Centre** | Beds, wards, alerts dashboard |
| **EMR** | Patient roster, SOAP, vitals, meds, labs tabs |
| **Cashier** | Bills, collect payment, AKSHIA tags |
| **Beds / Flow / Staffing** | Operational boards |
| **CPOE pathways** | `POST /api/v1/cpoe/order-sets/apply` → bus events |
| **Lab results** | `POST /api/v1/lab/results` → LIVE to OS |
| **Pharmacy dispense** | `POST /api/v1/pharmacy/stock/deplete` → bus |
| **HMO eligibility** | `POST /api/v1/hmo/eligibility` (AKSHIA/NHIA demo policies) |
| **SMS / USSD** | `POST /api/v1/comms/sms/send` · USSD `*384*48#` sim |

---

## 4. Smoke test (clinical loop)

With API running:

```bash
./scripts/demo-clinical-loop.sh
```

Or manually:

```bash
curl -s -X POST http://localhost:4000/api/v1/lab/results \
  -H 'Content-Type: application/json' \
  -d '{
    "patientId":"PAT-1",
    "patientName":"Uduak Essen",
    "facilityId":"AKS-IBOM-SPECIALIST",
    "testName":"Troponin I",
    "results":[{"parameter":"Troponin I","value":"2.1","unit":"ng/mL","referenceRange":"<0.04","flag":"CRITICAL"}],
    "verifiedBy":"Lab Tech"
  }'
```

Logged-in OS should show the alert on the bell (facilityId must match session hospital id when filtered).

---

## 5. HMO demo policy IDs

| Policy ID | Result |
|-----------|--------|
| `AKSHIA-POL-88201` | Eligible, comprehensive |
| `AKSHIA-POL-39102` | Eligible, basic |
| `NHIA-VULN-00412` | Eligible, 0% copay |
| `AKSHIA-POL-EXPIRED` | Not eligible |

```bash
curl -s -X POST http://localhost:4000/api/v1/hmo/eligibility \
  -H 'Content-Type: application/json' \
  -d '{"policyId":"AKSHIA-POL-88201","facilityId":"AKS-IBOM-SPECIALIST"}'
```

---

## 6. Env (optional)

```bash
export PORT=4000
export NEXT_PUBLIC_WS_URL=ws://localhost:4000/ws
export GEMINI_API_KEY=          # if AI engine configured
export DHIS2_BASE_URL=          # when linking NHMIS
```

---

## 7. Same-day operating rules

1. Keep **API terminal running** all shift — UI alone has no LIVE bus.
2. Prefer **Chrome/Edge** desktop for Hospital OS.
3. Train: Command Centre → EMR → Cashier path for one patient journey.
4. Critical labs: always verify on `POST /lab/results` so doctors get the bell.
5. SMS is **simulated** until Termii / Africa’s Talking keys are set.
6. Data is **in-memory / local** unless Postgres is configured — plan nightly export if needed.

---

## 8. Support contacts (fill in on site)

| Role | Name | Phone |
|------|------|-------|
| ICT on site | | |
| Clinical lead | | |
| Pharmacy lead | | |

---

*MedCore OS · Powered by M87 · Akwa Ibom*
