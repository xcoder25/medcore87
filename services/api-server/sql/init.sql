-- MedCore core tables (Phase: durable store readiness)
-- Attendance: events only — no video/blob storage

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  state_code TEXT DEFAULT 'AK',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  mrn TEXT NOT NULL,
  state_health_id TEXT,
  nin TEXT,
  full_name TEXT NOT NULL,
  dob DATE,
  gender TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_facility ON patients(facility_id);
CREATE INDEX IF NOT EXISTS idx_patients_state_health_id ON patients(state_health_id);
CREATE INDEX IF NOT EXISTS idx_patients_mrn ON patients(mrn);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL,
  badge_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role_key TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_facility ON staff(facility_id);
CREATE INDEX IF NOT EXISTS idx_staff_badge ON staff(badge_id);

-- Time & attendance: punch events only (live AI recognition → this row)
CREATE TABLE IF NOT EXISTS attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL,
  staff_id TEXT,
  badge_id TEXT,
  staff_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('IN', 'OUT')),
  punched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT DEFAULT 'LIVE_AI',  -- LIVE_AI | MANUAL | DEVICE
  camera_id TEXT,                 -- which live camera, not a video file
  confidence REAL,                -- 0..1 model confidence
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_facility_time ON attendance_events(facility_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_badge ON attendance_events(badge_id, punched_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  facility_id TEXT,
  actor_id TEXT,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inpatient / ER Encounters
CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  encounter_type TEXT NOT NULL, -- INPATIENT, EMERGENCY, OUTPATIENT, SURGICAL
  ward TEXT,
  bed_number TEXT,
  admitting_doctor_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DISCHARGED, TRANSFERRED
  chief_complaint TEXT,
  working_diagnosis TEXT,
  care_first_emergency BOOLEAN DEFAULT FALSE,
  admitted_at TIMESTAMPTZ DEFAULT NOW(),
  discharged_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters(patient_id);
CREATE INDEX IF NOT EXISTS idx_encounters_facility ON encounters(facility_id);

-- CPOE Clinical Orders (Labs, Imaging, Procedures, Nursing)
CREATE TABLE IF NOT EXISTS clinical_orders (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  encounter_id TEXT REFERENCES encounters(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  category TEXT NOT NULL, -- LABORATORY, PHARMACY, RADIOLOGY, PROCEDURE, NURSING
  title TEXT NOT NULL,
  details TEXT,
  priority TEXT NOT NULL DEFAULT 'ROUTINE', -- ROUTINE, URGENT, STAT
  status TEXT NOT NULL DEFAULT 'PENDING',
  ordered_by_doctor_id TEXT NOT NULL,
  ordered_by_doctor_name TEXT NOT NULL,
  billed BOOLEAN DEFAULT FALSE,
  cost NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_patient ON clinical_orders(patient_id);
CREATE INDEX IF NOT EXISTS idx_orders_facility ON clinical_orders(facility_id);

-- Prescriptions & Formularies
CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  encounter_id TEXT REFERENCES encounters(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  doctor_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  diagnosis TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DISPENSED, PARTIAL, CANCELLED
  is_controlled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  route TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  instructions TEXT,
  dispensed BOOLEAN DEFAULT FALSE,
  dispensed_at TIMESTAMPTZ,
  dispensed_by TEXT
);

-- Bedside eMAR (Barcode Medication Administration Logs)
CREATE TABLE IF NOT EXISTS medication_administrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id TEXT REFERENCES prescriptions(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  drug_name TEXT NOT NULL,
  dose_given TEXT NOT NULL,
  route TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'GIVEN', -- GIVEN, HELD, REFUSED, OMITTED
  verified_via_barcode BOOLEAN DEFAULT TRUE,
  patient_barcode_scanned TEXT,
  drug_barcode_scanned TEXT,
  systolic_bp INTEGER,
  heart_rate INTEGER,
  administered_by_badge TEXT NOT NULL,
  administered_by_name TEXT NOT NULL,
  witness_badge TEXT,
  witness_name TEXT,
  is_controlled_substance BOOLEAN DEFAULT FALSE,
  holding_reason TEXT,
  administered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emar_patient ON medication_administrations(patient_id);
CREATE INDEX IF NOT EXISTS idx_emar_facility ON medication_administrations(facility_id);

-- Controlled Substances Dangerous Drugs Register (DDR)
CREATE TABLE IF NOT EXISTS controlled_substances_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  ward TEXT NOT NULL,
  drug_name TEXT NOT NULL,
  strength TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  starting_balance INTEGER NOT NULL,
  quantity_deducted INTEGER NOT NULL DEFAULT 1,
  remaining_balance INTEGER NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  prescribed_by_doctor TEXT NOT NULL,
  primary_nurse_name TEXT NOT NULL,
  witness_nurse_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Vital Signs & Automated NEWS2 Scores
CREATE TABLE IF NOT EXISTS vital_signs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  bed_number TEXT,
  respiration_rate INTEGER NOT NULL,
  spo2_percent INTEGER NOT NULL,
  on_supplemental_oxygen BOOLEAN DEFAULT FALSE,
  spo2_scale INTEGER DEFAULT 1,
  systolic_bp INTEGER NOT NULL,
  diastolic_bp INTEGER,
  pulse_rate INTEGER NOT NULL,
  consciousness TEXT NOT NULL DEFAULT 'ALERT', -- ALERT, CVPU
  temperature_celsius NUMERIC(4, 1) NOT NULL,
  news2_total_score INTEGER NOT NULL,
  news2_risk_category TEXT NOT NULL, -- LOW, MEDIUM, HIGH
  escalation_triggered BOOLEAN DEFAULT FALSE,
  recorded_by_badge TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vitals_patient ON vital_signs(patient_id);

-- Emergency Break-Glass & Override Ledger
CREATE TABLE IF NOT EXISTS break_glass_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  facility_id TEXT NOT NULL REFERENCES facilities(id),
  clinician_badge TEXT NOT NULL,
  reason_category TEXT NOT NULL,
  justification_note TEXT NOT NULL,
  bypass_billing_granted BOOLEAN DEFAULT TRUE,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE attendance_events IS 'Staff time-book only. No CCTV/video blobs. Live feed is processed and discarded.';
COMMENT ON TABLE controlled_substances_ledger IS 'Schedule II & III Dangerous Drugs Register (DDR) legal narcotics audit book.';
