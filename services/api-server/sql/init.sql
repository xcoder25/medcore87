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

COMMENT ON TABLE attendance_events IS 'Staff time-book only. No CCTV/video blobs. Live feed is processed and discarded.';
