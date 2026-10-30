/**
 * DHIS2 Tracker & Simulated Bed Management Bridge
 *
 * Implements:
 * 1. Tracked Entity Types: Patient (TET_PATIENT_01) and Physical Bed Asset (TET_BED_01)
 * 2. Inpatient Program metadata structure with 4 Program Stages:
 *    - Stage 1: Admission & Bed Allocation
 *    - Stage 2: Clinical Care / Daily Vitals (Repeatable)
 *    - Stage 3: Bed / Ward Transfer (Repeatable)
 *    - Stage 4: Discharge & Disposition
 * 3. Core Program Indicators (BOR, ALOS, BTI, BTR) with standard DHIS2 analytics expressions
 * 4. Standardized location string convention: WARD-ROOM-BED (e.g. ICU-RM102-B1, MMED-RM01-B1)
 * 5. Program Stage cross-referencing logic for simulated real-time bed states:
 *    - Green (Available): Bed ID has no active enrollment and not in cleaning window
 *    - Red (Occupied): Active enrollment with incomplete discharge
 *    - Yellow (Cleaning/Turnover): Discharge completed within last 2 hours (turnover window)
 * 6. DHIS2 Web API payload generators & exportable metadata package (/api/metadata & /api/tracker)
 */

export interface Dhis2TrackedEntityInstance {
  trackedEntity: string;
  trackedEntityType: string; // Patient TET UID
  orgUnit: string;
  attributes: Array<{
    attribute: string;
    value: string;
  }>;
  enrollments: Dhis2Enrollment[];
}

export interface Dhis2Enrollment {
  enrollment: string;
  program: string; // Inpatient Management Program UID
  orgUnit: string;
  enrolledAt: string;
  occurredAt: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  events: Dhis2ProgramEvent[];
}

export interface Dhis2ProgramEvent {
  event: string;
  program: string;
  programStage: string;
  orgUnit: string;
  occurredAt: string;
  status: 'ACTIVE' | 'COMPLETED' | 'SCHEDULE';
  dataValues: Array<{
    dataElement: string;
    value: string;
  }>;
}

export interface StandardBedLocation {
  ward: string;
  roomNumber: string;
  bedNumber: string;
  standardKey: string; // WARD-ROOM-BED (e.g. ICU-RM102-B1)
}

export type SimulatedBedState = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'isolation';

export interface SimulatedBedStatus {
  bedKey: string;
  ward: string;
  room: string;
  bed: string;
  state: SimulatedBedState;
  stateLabel: 'Available' | 'Occupied' | 'Cleaning / Turnover' | 'Out of Service' | 'Isolation';
  color: string;
  patient?: {
    teiId: string;
    enrollmentId: string;
    patientName: string;
    hospitalNumber: string;
    admittedAt: string;
    diagnosis?: string;
    priority?: string;
    doctor?: string;
    eventId: string;
    losDays?: number;
  };
  discharge?: {
    dischargedAt: string;
    outcome: string;
    minutesSinceDischarge: number;
    losDays?: number;
  };
}

// ─── DHIS2 METADATA CONSTANTS ──────────────────────────────────────────────────
export const DHIS2_INPATIENT_METADATA = {
  tetPatient: 'TET_PATIENT_01',
  tetBedAsset: 'TET_BED_ASSET_02',
  programInpatient: 'PRG_INPATIENT_MGT',
  stages: {
    admission: 'STG_ADMISSION_01',
    clinicalCare: 'STG_CLINICAL_CARE_02',
    transfer: 'STG_TRANSFER_03',
    discharge: 'STG_DISCHARGE_04',
  },
  dataElements: {
    // Stage 1: Admission
    admissionDate: 'DE_ADM_DATE',
    admittingDiagnosis: 'DE_ADM_DIAG',
    triagePriority: 'DE_TRIAGE_PRIO',
    ward: 'DE_LOC_WARD',
    roomNumber: 'DE_LOC_ROOM',
    bedNumber: 'DE_LOC_BED',
    standardBedKey: 'DE_LOC_BED_KEY', // WARD-ROOM-BED
    admittingClinician: 'DE_ADM_CLINICIAN',

    // Stage 2: Clinical Care / Daily Vitals (Repeatable)
    vitalBpSystolic: 'DE_VIT_BP_SYS',
    vitalBpDiastolic: 'DE_VIT_BP_DIA',
    vitalPulse: 'DE_VIT_PULSE',
    vitalTemp: 'DE_VIT_TEMP',
    vitalSpo2: 'DE_VIT_SPO2',
    vitalRespRate: 'DE_VIT_RESP_RATE',
    progressNote: 'DE_PROG_NOTE',
    medicationGiven: 'DE_MED_ADMIN',

    // Stage 3: Transfer
    transferDate: 'DE_TRF_DATE',
    transferFromBed: 'DE_TRF_FROM_BED',
    transferToBed: 'DE_TRF_TO_BED',
    transferReason: 'DE_TRF_REASON',
    transferAuthorizer: 'DE_TRF_AUTHORIZER',

    // Stage 4: Discharge
    dischargeDate: 'DE_DIS_DATE',
    dischargeOutcome: 'DE_DIS_OUTCOME', // discharged, referred, deceased, absconded
    finalDiagnosis: 'DE_FINAL_DIAG',
    lengthOfStayDays: 'DE_INPATIENT_LOS_DAYS',
    dischargingClinician: 'DE_DIS_CLINICIAN',
  },
  optionSets: {
    triagePriority: 'OPTSET_TRIAGE_PRIORITY',
    dischargeOutcome: 'OPTSET_DISCHARGE_OUTCOME',
    bedStatus: 'OPTSET_BED_STATUS',
  },
  programIndicators: {
    bedOccupancyRate: 'PI_BOR_INPATIENT',
    avgLengthOfStay: 'PI_ALOS_INPATIENT',
    bedTurnoverInterval: 'PI_BTI_INPATIENT',
    bedTurnoverRate: 'PI_BTR_INPATIENT',
  },
};

const STORAGE_KEY = 'medcore_dhis2_simulated_tracker_v1';
export const EVT_DHIS2_TRACKER = 'medcore-dhis2-tracker-updated';

/**
 * Normalizes input to strict WARD-ROOM-BED convention.
 * Example: 'ICU', '102', 'B1' -> 'ICU-RM102-B1'
 * Example: 'Male Medical', '1', 'Bed 04' -> 'MMED-RM1-BED04'
 */
export function formatStandardBedKey(ward: string, room: string, bed: string): string {
  const cleanWard = ward
    .toUpperCase()
    .replace(/MALE MEDICAL/i, 'MMED')
    .replace(/FEMALE MEDICAL/i, 'FMED')
    .replace(/SURGICAL/i, 'SURG')
    .replace(/PAEDIATRICS|PEDIATRICS/i, 'PED')
    .replace(/MATERNITY/i, 'MAT')
    .replace(/PACU/i, 'PACU')
    .replace(/[^A-Z0-9]/g, '');

  const cleanRoom = room.toUpperCase().startsWith('RM')
    ? room.toUpperCase().replace(/[^A-Z0-9]/g, '')
    : `RM${room.toUpperCase().replace(/[^0-9]/g, '') || '01'}`;

  const cleanBed = bed.toUpperCase().replace(/^BED\s*/i, 'B').replace(/[^A-Z0-9]/g, '');

  return `${cleanWard || 'GEN'}-${cleanRoom}-${cleanBed || 'B01'}`;
}

export function parseStandardBedKey(key: string): StandardBedLocation {
  const parts = key.split('-');
  return {
    ward: parts[0] || 'GEN',
    roomNumber: parts[1] || 'RM01',
    bedNumber: parts[2] || 'B01',
    standardKey: key,
  };
}

export interface InpatientTrackerRecord {
  id: string;
  teiId: string;
  enrollmentId: string;
  facilityId: string;
  patientName: string;
  hospitalNumber: string;
  bedKey: string;
  ward: string;
  room: string;
  bed: string;
  admittedAt: string;
  diagnosis: string;
  doctor?: string;
  priority: 'routine' | 'urgent' | 'emergency';
  admissionEventId: string;
  status: 'ACTIVE' | 'COMPLETED';
  dischargedAt?: string;
  dischargeOutcome?: 'discharged' | 'referred' | 'deceased' | 'absconded';
  dischargeEventId?: string;
  lengthOfStayDays?: number;
  transferEvents: Array<{
    id: string;
    at: string;
    fromBedKey: string;
    toBedKey: string;
    reason?: string;
    authorizer?: string;
  }>;
  vitalsEvents: Array<{
    id: string;
    at: string;
    bp?: string;
    pulse?: number;
    temp?: number;
    spo2?: number;
    respRate?: number;
    notes?: string;
  }>;
}

export function readTrackerStore(): InpatientTrackerRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveTrackerStore(data: InpatientTrackerRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(EVT_DHIS2_TRACKER, { detail: data }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: STORAGE_KEY } }));
}

/** Seed realistic hospital bed registry matching standard keys */
export const DEFAULT_HOSPITAL_BED_KEYS: StandardBedLocation[] = [
  { ward: 'ICU', roomNumber: 'RM101', bedNumber: 'B1', standardKey: 'ICU-RM101-B1' },
  { ward: 'ICU', roomNumber: 'RM101', bedNumber: 'B2', standardKey: 'ICU-RM101-B2' },
  { ward: 'ICU', roomNumber: 'RM102', bedNumber: 'B1', standardKey: 'ICU-RM102-B1' },
  { ward: 'ICU', roomNumber: 'RM102', bedNumber: 'B2', standardKey: 'ICU-RM102-B2' },
  { ward: 'Male Medical', roomNumber: 'RM01', bedNumber: 'B1', standardKey: 'MMED-RM01-B1' },
  { ward: 'Male Medical', roomNumber: 'RM01', bedNumber: 'B2', standardKey: 'MMED-RM01-B2' },
  { ward: 'Male Medical', roomNumber: 'RM02', bedNumber: 'B1', standardKey: 'MMED-RM02-B1' },
  { ward: 'Male Medical', roomNumber: 'RM02', bedNumber: 'B2', standardKey: 'MMED-RM02-B2' },
  { ward: 'Female Medical', roomNumber: 'RM01', bedNumber: 'B1', standardKey: 'FMED-RM01-B1' },
  { ward: 'Female Medical', roomNumber: 'RM01', bedNumber: 'B2', standardKey: 'FMED-RM01-B2' },
  { ward: 'Female Medical', roomNumber: 'RM02', bedNumber: 'B1', standardKey: 'FMED-RM02-B1' },
  { ward: 'Female Medical', roomNumber: 'RM02', bedNumber: 'B2', standardKey: 'FMED-RM02-B2' },
  { ward: 'Surgical', roomNumber: 'RM01', bedNumber: 'B1', standardKey: 'SURG-RM01-B1' },
  { ward: 'Surgical', roomNumber: 'RM01', bedNumber: 'B2', standardKey: 'SURG-RM01-B2' },
  { ward: 'Surgical', roomNumber: 'RM02', bedNumber: 'B1', standardKey: 'SURG-RM02-B1' },
  { ward: 'Paediatrics', roomNumber: 'RM01', bedNumber: 'B1', standardKey: 'PED-RM01-B1' },
  { ward: 'Paediatrics', roomNumber: 'RM01', bedNumber: 'B2', standardKey: 'PED-RM01-B2' },
  { ward: 'Maternity', roomNumber: 'RM01', bedNumber: 'B1', standardKey: 'MAT-RM01-B1' },
  { ward: 'Maternity', roomNumber: 'RM01', bedNumber: 'B2', standardKey: 'MAT-RM01-B2' },
];

/** Flag to prevent circular event loops when synchronizing with bedBoardStore */
let _isSyncingFromBedBoard = false;

/**
 * Calculates current real-time simulated bed board states based on active DHIS2 Tracker enrollments:
 * - Green (Available): Bed ID is empty in current active patient list and no discharge within 2 hours.
 * - Red (Occupied): Active enrollment where Discharge Stage is incomplete.
 * - Yellow (Cleaning/Turnover): Patient discharged within turnover window (default 2 hours).
 */
export function calculateSimulatedBedBoard(
  facilityId: string,
  turnoverWindowHours: number = 2,
  overrideBedLocations?: StandardBedLocation[]
): SimulatedBedStatus[] {
  const records = readTrackerStore().filter((r) => r.facilityId === facilityId);
  const now = Date.now();
  const turnoverMs = turnoverWindowHours * 60 * 60 * 1000;
  const locations = overrideBedLocations && overrideBedLocations.length > 0
    ? overrideBedLocations
    : DEFAULT_HOSPITAL_BED_KEYS;

  return locations.map((loc) => {
    // 1. Check for active enrollment (Occupied)
    const active = records.find(
      (r) => r.bedKey === loc.standardKey && r.status === 'ACTIVE'
    );

    if (active) {
      const los = Math.max(0, Math.floor((now - new Date(active.admittedAt).getTime()) / 86400000));
      return {
        bedKey: loc.standardKey,
        ward: loc.ward,
        room: loc.roomNumber,
        bed: loc.bedNumber,
        state: 'occupied',
        stateLabel: 'Occupied',
        color: '#DC2626', // Red
        patient: {
          teiId: active.teiId,
          enrollmentId: active.enrollmentId,
          patientName: active.patientName,
          hospitalNumber: active.hospitalNumber,
          admittedAt: active.admittedAt,
          diagnosis: active.diagnosis,
          priority: active.priority,
          doctor: active.doctor,
          eventId: active.admissionEventId,
          losDays: los,
        },
      };
    }

    // 2. Check for recent discharge within turnover window (Cleaning / Turnover)
    const recentDischarge = records
      .filter((r) => r.bedKey === loc.standardKey && r.status === 'COMPLETED' && r.dischargedAt)
      .sort((a, b) => new Date(b.dischargedAt!).getTime() - new Date(a.dischargedAt!).getTime())[0];

    if (recentDischarge && recentDischarge.dischargedAt) {
      const diffMs = now - new Date(recentDischarge.dischargedAt).getTime();
      if (diffMs <= turnoverMs) {
        const mins = Math.round(diffMs / 60000);
        return {
          bedKey: loc.standardKey,
          ward: loc.ward,
          room: loc.roomNumber,
          bed: loc.bedNumber,
          state: 'cleaning',
          stateLabel: 'Cleaning / Turnover',
          color: '#EAB308', // Yellow
          discharge: {
            dischargedAt: recentDischarge.dischargedAt,
            outcome: recentDischarge.dischargeOutcome || 'discharged',
            minutesSinceDischarge: mins,
            losDays: recentDischarge.lengthOfStayDays,
          },
        };
      }
    }

    // 3. Available (Green)
    return {
      bedKey: loc.standardKey,
      ward: loc.ward,
      room: loc.roomNumber,
      bed: loc.bedNumber,
      state: 'available',
      stateLabel: 'Available',
      color: '#16A34A', // Green
    };
  });
}

/**
 * Stage 1: Admission
 * Enrolls a Patient into DHIS2 Tracker Inpatient Program with WARD-ROOM-BED metadata.
 */
export function admitPatientTracker(input: {
  facilityId: string;
  patientName: string;
  hospitalNumber: string;
  ward: string;
  room: string;
  bed: string;
  diagnosis: string;
  doctor?: string;
  priority?: 'routine' | 'urgent' | 'emergency';
  admittedAt?: string;
}): InpatientTrackerRecord {
  const standardKey = formatStandardBedKey(input.ward, input.room, input.bed);
  const now = input.admittedAt || new Date().toISOString();
  const teiId = `TEI-${Date.now().toString(36).toUpperCase()}`;
  const enrollmentId = `ENR-${Date.now().toString(36).toUpperCase()}`;
  const admissionEventId = `EVT-ADM-${Date.now().toString(36).toUpperCase()}`;

  const record: InpatientTrackerRecord = {
    id: `INP-${Date.now().toString(36).toUpperCase()}`,
    teiId,
    enrollmentId,
    facilityId: input.facilityId,
    patientName: input.patientName,
    hospitalNumber: input.hospitalNumber,
    bedKey: standardKey,
    ward: input.ward,
    room: input.room,
    bed: input.bed,
    admittedAt: now,
    diagnosis: input.diagnosis,
    doctor: input.doctor,
    priority: input.priority || 'routine',
    admissionEventId,
    status: 'ACTIVE',
    transferEvents: [],
    vitalsEvents: [],
  };

  const store = readTrackerStore();
  // Clear any existing active admission on this bed
  const filtered = store.filter((r) => !(r.bedKey === standardKey && r.status === 'ACTIVE'));
  saveTrackerStore([record, ...filtered]);

  // Dispatch OS sync event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('medcore-bed-sync-bridge', {
        detail: { action: 'admit', record },
      })
    );
  }

  return record;
}

/**
 * Stage 3: Bed / Ward Transfer
 * Logs transfer stage event and updates patient's bed location in DHIS2 Tracker.
 */
export function transferPatientBedTracker(
  enrollmentId: string,
  newWard: string,
  newRoom: string,
  newBed: string,
  reason?: string,
  authorizer?: string
): boolean {
  const store = readTrackerStore();
  const idx = store.findIndex((r) => r.enrollmentId === enrollmentId && r.status === 'ACTIVE');
  if (idx < 0) return false;

  const oldBedKey = store[idx].bedKey;
  const newKey = formatStandardBedKey(newWard, newRoom, newBed);
  const now = new Date().toISOString();

  store[idx].transferEvents = store[idx].transferEvents || [];
  store[idx].transferEvents.push({
    id: `EVT-TRF-${Date.now().toString(36).toUpperCase()}`,
    at: now,
    fromBedKey: oldBedKey,
    toBedKey: newKey,
    reason: reason || 'Clinical bed transfer',
    authorizer: authorizer || 'Attending Clinician',
  });

  store[idx].ward = newWard;
  store[idx].room = newRoom;
  store[idx].bed = newBed;
  store[idx].bedKey = newKey;

  saveTrackerStore(store);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('medcore-bed-sync-bridge', {
        detail: { action: 'transfer', record: store[idx], oldBedKey, newKey },
      })
    );
  }

  return true;
}

/**
 * Stage 2: Clinical Care / Daily Vitals (Repeatable)
 */
export function recordInpatientVitalsTracker(
  enrollmentId: string,
  vitals: {
    bp?: string;
    pulse?: number;
    temp?: number;
    spo2?: number;
    respRate?: number;
    notes?: string;
  }
): boolean {
  const store = readTrackerStore();
  const idx = store.findIndex((r) => r.enrollmentId === enrollmentId && r.status === 'ACTIVE');
  if (idx < 0) return false;

  store[idx].vitalsEvents = store[idx].vitalsEvents || [];
  store[idx].vitalsEvents.push({
    id: `EVT-VIT-${Date.now().toString(36).toUpperCase()}`,
    at: new Date().toISOString(),
    ...vitals,
  });
  saveTrackerStore(store);
  return true;
}

/**
 * Stage 4: Discharge / Disposition (Free Bed)
 * Completes the enrollment via PUT /api/tracker/enrollments/{enrollmentId} (status: COMPLETED).
 * Immediately triggers the 2-hour Turnover / Cleaning state (Yellow).
 */
export function dischargePatientTracker(
  enrollmentId: string,
  outcome: 'discharged' | 'referred' | 'deceased' | 'absconded' = 'discharged'
): boolean {
  const store = readTrackerStore();
  const idx = store.findIndex((r) => r.enrollmentId === enrollmentId && r.status === 'ACTIVE');
  if (idx < 0) return false;

  const now = new Date().toISOString();
  const admitTime = new Date(store[idx].admittedAt).getTime();
  const los = Math.max(0, Math.floor((new Date(now).getTime() - admitTime) / 86400000));

  store[idx].status = 'COMPLETED';
  store[idx].dischargedAt = now;
  store[idx].dischargeOutcome = outcome;
  store[idx].lengthOfStayDays = los;
  store[idx].dischargeEventId = `EVT-DIS-${Date.now().toString(36).toUpperCase()}`;

  saveTrackerStore(store);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('medcore-bed-sync-bridge', {
        detail: { action: 'discharge', record: store[idx] },
      })
    );
  }

  return true;
}

/** Mark turnover completed early (turn yellow bed back to green) */
export function clearBedTurnover(bedKey: string): boolean {
  const store = readTrackerStore();
  const updated = store.map((r) => {
    if (r.bedKey === bedKey && r.status === 'COMPLETED') {
      return { ...r, dischargedAt: new Date(Date.now() - 24 * 3600000).toISOString() };
    }
    return r;
  });
  saveTrackerStore(updated);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('medcore-bed-sync-bridge', {
        detail: { action: 'clean', bedKey },
      })
    );
  }

  return true;
}

export function subscribeDhis2Tracker(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVT_DHIS2_TRACKER, cb);
  window.addEventListener('storage', cb);
  window.addEventListener('medcore-bed-board', cb);
  return () => {
    window.removeEventListener(EVT_DHIS2_TRACKER, cb);
    window.removeEventListener('storage', cb);
    window.removeEventListener('medcore-bed-board', cb);
  };
}

/**
 * Synchronize clinical bed census (from bedBoardStore) into DHIS2 Tracker records.
 * Ensures any bed admitted through Nursing, Doctor, PACU, or Maternity is tracked in DHIS2.
 */
export function syncTrackerFromBedRecord(bed: {
  facilityId: string;
  ward: string;
  bedNo: string;
  status: string;
  patient?: string;
  hospitalNumber?: string;
  doctor?: string;
  diagnosis?: string;
  admitAt?: string;
}) {
  if (_isSyncingFromBedBoard) return;
  _isSyncingFromBedBoard = true;
  try {
    const key = formatStandardBedKey(bed.ward, 'RM01', bed.bedNo);
    const store = readTrackerStore();

    if (bed.status === 'occupied' || bed.status === 'isolation') {
      const existing = store.find((r) => r.bedKey === key && r.status === 'ACTIVE');
      if (!existing && bed.patient) {
        admitPatientTracker({
          facilityId: bed.facilityId,
          patientName: bed.patient,
          hospitalNumber: bed.hospitalNumber || `GH-${Date.now().toString().slice(-4)}`,
          ward: bed.ward,
          room: 'RM01',
          bed: bed.bedNo,
          diagnosis: bed.diagnosis || 'Inpatient Admission',
          doctor: bed.doctor,
          admittedAt: bed.admitAt,
        });
      }
    } else if (bed.status === 'cleaning' || bed.status === 'available') {
      const existing = store.find((r) => r.bedKey === key && r.status === 'ACTIVE');
      if (existing) {
        dischargePatientTracker(existing.enrollmentId, 'discharged');
      }
    }
  } finally {
    _isSyncingFromBedBoard = false;
  }
}

/**
 * Generates the complete DHIS2 Tracker Inpatient Management metadata JSON package
 * ready for import into DHIS2 instances via /api/metadata.
 */
export function buildDhis2MetadataPackage() {
  const M = DHIS2_INPATIENT_METADATA;

  return {
    packageVersion: '2.40-compatible',
    exportedAt: new Date().toISOString(),
    system: 'MedCore Hospital OS - DHIS2 Interoperability Engine',
    trackedEntityTypes: [
      {
        id: M.tetPatient,
        name: 'Patient',
        description: 'Individual person registered in the health facility EMR (Tracked Entity)',
      },
      {
        id: M.tetBedAsset,
        name: 'Hospital Bed (Asset)',
        description: 'Non-human physical asset tracked for bed bureau management',
      },
    ],
    trackedEntityAttributes: [
      { id: 'ATTR_NAME', name: 'Patient Full Name', valueType: 'TEXT' },
      { id: 'ATTR_MRN', name: 'Medical Record Number / Hospital Number', valueType: 'TEXT', unique: true },
      { id: 'ATTR_NIN', name: 'National Identification Number (NIN)', valueType: 'TEXT' },
      { id: 'ATTR_UPI', name: 'Universal Patient Identifier (UPI)', valueType: 'TEXT' },
      { id: 'ATTR_DOB', name: 'Date of Birth', valueType: 'DATE' },
      { id: 'ATTR_SEX', name: 'Sex', valueType: 'TEXT' },
    ],
    optionSets: [
      {
        id: M.optionSets.triagePriority,
        name: 'Inpatient - Triage Priority OptionSet',
        valueType: 'TEXT',
        options: [
          { code: 'routine', name: 'Routine / Non-Urgent' },
          { code: 'urgent', name: 'Urgent' },
          { code: 'emergency', name: 'Emergency / Resuscitation' },
        ],
      },
      {
        id: M.optionSets.dischargeOutcome,
        name: 'Inpatient - Discharge Disposition OptionSet',
        valueType: 'TEXT',
        options: [
          { code: 'discharged', name: 'Discharged Home' },
          { code: 'referred', name: 'Referred to Higher Facility' },
          { code: 'absconded', name: 'Absconded / Discharge Against Medical Advice' },
          { code: 'deceased', name: 'Deceased' },
        ],
      },
      {
        id: M.optionSets.bedStatus,
        name: 'Bed Status OptionSet',
        valueType: 'TEXT',
        options: [
          { code: 'available', name: 'Available / Clean (Green)' },
          { code: 'occupied', name: 'Occupied (Red)' },
          { code: 'cleaning', name: 'Cleaning / Turnover (Yellow)' },
          { code: 'maintenance', name: 'Maintenance / Out of Service' },
          { code: 'isolation', name: 'Isolation' },
        ],
      },
    ],
    dataElements: [
      // Admission Stage
      { id: M.dataElements.admissionDate, name: 'Inpatient - Admission Date', valueType: 'DATETIME', domainType: 'TRACKER' },
      { id: M.dataElements.admittingDiagnosis, name: 'Inpatient - Admitting Diagnosis', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.triagePriority, name: 'Inpatient - Triage Priority', valueType: 'TEXT', domainType: 'TRACKER', optionSet: { id: M.optionSets.triagePriority } },
      { id: M.dataElements.ward, name: 'Inpatient - Ward', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.roomNumber, name: 'Inpatient - Room Number', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.bedNumber, name: 'Inpatient - Bed Number', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.standardBedKey, name: 'Inpatient - Standard Bed Key (WARD-ROOM-BED)', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.admittingClinician, name: 'Inpatient - Admitting Clinician', valueType: 'TEXT', domainType: 'TRACKER' },

      // Clinical Care Stage
      { id: M.dataElements.vitalBpSystolic, name: 'Inpatient - BP Systolic (mmHg)', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.vitalBpDiastolic, name: 'Inpatient - BP Diastolic (mmHg)', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.vitalPulse, name: 'Inpatient - Pulse Rate (bpm)', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.vitalTemp, name: 'Inpatient - Temperature (°C)', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.vitalSpo2, name: 'Inpatient - SpO2 (%)', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.vitalRespRate, name: 'Inpatient - Respiration Rate (/min)', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.progressNote, name: 'Inpatient - Clinical Progress Note', valueType: 'LONG_TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.medicationGiven, name: 'Inpatient - Medication Administered (e-MAR)', valueType: 'LONG_TEXT', domainType: 'TRACKER' },

      // Transfer Stage
      { id: M.dataElements.transferDate, name: 'Inpatient - Transfer Date', valueType: 'DATETIME', domainType: 'TRACKER' },
      { id: M.dataElements.transferFromBed, name: 'Inpatient - Transfer From Bed', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.transferToBed, name: 'Inpatient - Transfer To Bed', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.transferReason, name: 'Inpatient - Transfer Reason', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.transferAuthorizer, name: 'Inpatient - Transfer Authorized By', valueType: 'TEXT', domainType: 'TRACKER' },

      // Discharge Stage
      { id: M.dataElements.dischargeDate, name: 'Inpatient - Discharge Date', valueType: 'DATETIME', domainType: 'TRACKER' },
      { id: M.dataElements.dischargeOutcome, name: 'Inpatient - Discharge Disposition', valueType: 'TEXT', domainType: 'TRACKER', optionSet: { id: M.optionSets.dischargeOutcome } },
      { id: M.dataElements.finalDiagnosis, name: 'Inpatient - Final Diagnosis', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.lengthOfStayDays, name: 'Inpatient - Length of Stay (Days)', valueType: 'INTEGER', domainType: 'TRACKER' },
      { id: M.dataElements.dischargingClinician, name: 'Inpatient - Discharging Clinician', valueType: 'TEXT', domainType: 'TRACKER' },
    ],
    programs: [
      {
        id: M.programInpatient,
        name: 'Inpatient Bed & Patient Tracker',
        shortName: 'Inpatient Tracker',
        programType: 'WITH_REGISTRATION',
        trackedEntityType: { id: M.tetPatient },
        programStages: [
          {
            id: M.stages.admission,
            name: 'Stage 1: Admission & Bed Allocation',
            repeatable: false,
            programStageDataElements: [
              { dataElement: { id: M.dataElements.admissionDate }, compulsory: true },
              { dataElement: { id: M.dataElements.admittingDiagnosis }, compulsory: true },
              { dataElement: { id: M.dataElements.triagePriority }, compulsory: true },
              { dataElement: { id: M.dataElements.ward }, compulsory: true },
              { dataElement: { id: M.dataElements.roomNumber }, compulsory: true },
              { dataElement: { id: M.dataElements.bedNumber }, compulsory: true },
              { dataElement: { id: M.dataElements.standardBedKey }, compulsory: true },
              { dataElement: { id: M.dataElements.admittingClinician }, compulsory: false },
            ],
          },
          {
            id: M.stages.clinicalCare,
            name: 'Stage 2: Clinical Care / Daily Vitals',
            repeatable: true,
            programStageDataElements: [
              { dataElement: { id: M.dataElements.vitalBpSystolic }, compulsory: false },
              { dataElement: { id: M.dataElements.vitalBpDiastolic }, compulsory: false },
              { dataElement: { id: M.dataElements.vitalPulse }, compulsory: false },
              { dataElement: { id: M.dataElements.vitalTemp }, compulsory: false },
              { dataElement: { id: M.dataElements.vitalSpo2 }, compulsory: false },
              { dataElement: { id: M.dataElements.vitalRespRate }, compulsory: false },
              { dataElement: { id: M.dataElements.progressNote }, compulsory: false },
              { dataElement: { id: M.dataElements.medicationGiven }, compulsory: false },
            ],
          },
          {
            id: M.stages.transfer,
            name: 'Stage 3: Bed / Ward Transfer',
            repeatable: true,
            programStageDataElements: [
              { dataElement: { id: M.dataElements.transferDate }, compulsory: true },
              { dataElement: { id: M.dataElements.transferFromBed }, compulsory: true },
              { dataElement: { id: M.dataElements.transferToBed }, compulsory: true },
              { dataElement: { id: M.dataElements.transferReason }, compulsory: false },
              { dataElement: { id: M.dataElements.transferAuthorizer }, compulsory: false },
            ],
          },
          {
            id: M.stages.discharge,
            name: 'Stage 4: Discharge & Disposition',
            repeatable: false,
            programStageDataElements: [
              { dataElement: { id: M.dataElements.dischargeDate }, compulsory: true },
              { dataElement: { id: M.dataElements.dischargeOutcome }, compulsory: true },
              { dataElement: { id: M.dataElements.finalDiagnosis }, compulsory: true },
              { dataElement: { id: M.dataElements.lengthOfStayDays }, compulsory: false },
              { dataElement: { id: M.dataElements.dischargingClinician }, compulsory: false },
            ],
          },
        ],
      },
    ],
    programIndicators: [
      {
        id: M.programIndicators.bedOccupancyRate,
        name: 'Bed Occupancy Rate (BOR %)',
        shortName: 'BOR %',
        program: { id: M.programInpatient },
        aggregationType: 'AVERAGE',
        expression: '( #{d2:daysBetween(V{enrollment_date}, V{incident_date})} / ( [Total Functional Beds] * [Days in Period] ) ) * 100',
        filter: 'V{enrollment_status} == "ACTIVE" || V{enrollment_status} == "COMPLETED"',
        decimals: 1,
      },
      {
        id: M.programIndicators.avgLengthOfStay,
        name: 'Average Length of Stay (ALOS Days)',
        shortName: 'ALOS',
        program: { id: M.programInpatient },
        aggregationType: 'AVERAGE',
        expression: 'd2:daysBetween(#{STG_ADMISSION_01.DE_ADM_DATE}, #{STG_DISCHARGE_04.DE_DIS_DATE})',
        filter: 'V{program_stage_id} == "STG_DISCHARGE_04" && d2:hasValue(#{STG_DISCHARGE_04.DE_DIS_DATE})',
        decimals: 1,
      },
      {
        id: M.programIndicators.bedTurnoverInterval,
        name: 'Bed Turnover Interval (BTI Days)',
        shortName: 'BTI',
        program: { id: M.programInpatient },
        aggregationType: 'AVERAGE',
        expression: '( ( [Total Beds] * [Days in Period] ) - [Total Inpatient Days] ) / [Total Discharges]',
        decimals: 1,
      },
      {
        id: M.programIndicators.bedTurnoverRate,
        name: 'Bed Turnover Rate (Discharges per Bed)',
        shortName: 'BTR',
        program: { id: M.programInpatient },
        aggregationType: 'SUM',
        expression: 'V{event_count} / [Total Beds]',
        filter: 'V{program_stage_id} == "STG_DISCHARGE_04"',
        decimals: 2,
      },
    ],
  };
}

/**
 * Generates standard DHIS2 Tracker Web API payload for /api/tracker?async=false
 */
export function buildDhis2TrackerPayload(record: InpatientTrackerRecord, orgUnitUid: string = 'AKS-OU-DEMO') {
  const M = DHIS2_INPATIENT_METADATA;

  const events: Dhis2ProgramEvent[] = [
    {
      event: record.admissionEventId,
      program: M.programInpatient,
      programStage: M.stages.admission,
      orgUnit: orgUnitUid,
      occurredAt: record.admittedAt,
      status: 'COMPLETED',
      dataValues: [
        { dataElement: M.dataElements.admissionDate, value: record.admittedAt },
        { dataElement: M.dataElements.admittingDiagnosis, value: record.diagnosis },
        { dataElement: M.dataElements.triagePriority, value: record.priority },
        { dataElement: M.dataElements.ward, value: record.ward },
        { dataElement: M.dataElements.roomNumber, value: record.room },
        { dataElement: M.dataElements.bedNumber, value: record.bed },
        { dataElement: M.dataElements.standardBedKey, value: record.bedKey },
      ],
    },
  ];

  if (record.vitalsEvents && record.vitalsEvents.length > 0) {
    for (const v of record.vitalsEvents) {
      events.push({
        event: v.id,
        program: M.programInpatient,
        programStage: M.stages.clinicalCare,
        orgUnit: orgUnitUid,
        occurredAt: v.at,
        status: 'COMPLETED',
        dataValues: [
          ...(v.pulse ? [{ dataElement: M.dataElements.vitalPulse, value: String(v.pulse) }] : []),
          ...(v.temp ? [{ dataElement: M.dataElements.vitalTemp, value: String(v.temp) }] : []),
          ...(v.spo2 ? [{ dataElement: M.dataElements.vitalSpo2, value: String(v.spo2) }] : []),
          ...(v.respRate ? [{ dataElement: M.dataElements.vitalRespRate, value: String(v.respRate) }] : []),
          ...(v.notes ? [{ dataElement: M.dataElements.progressNote, value: v.notes }] : []),
        ],
      });
    }
  }

  if (record.transferEvents && record.transferEvents.length > 0) {
    for (const t of record.transferEvents) {
      events.push({
        event: t.id,
        program: M.programInpatient,
        programStage: M.stages.transfer,
        orgUnit: orgUnitUid,
        occurredAt: t.at,
        status: 'COMPLETED',
        dataValues: [
          { dataElement: M.dataElements.transferDate, value: t.at },
          { dataElement: M.dataElements.transferFromBed, value: t.fromBedKey },
          { dataElement: M.dataElements.transferToBed, value: t.toBedKey },
          ...(t.reason ? [{ dataElement: M.dataElements.transferReason, value: t.reason }] : []),
        ],
      });
    }
  }

  if (record.status === 'COMPLETED' && record.dischargedAt) {
    events.push({
      event: record.dischargeEventId || `EVT-DIS-${Date.now().toString(36).toUpperCase()}`,
      program: M.programInpatient,
      programStage: M.stages.discharge,
      orgUnit: orgUnitUid,
      occurredAt: record.dischargedAt,
      status: 'COMPLETED',
      dataValues: [
        { dataElement: M.dataElements.dischargeDate, value: record.dischargedAt },
        { dataElement: M.dataElements.dischargeOutcome, value: record.dischargeOutcome || 'discharged' },
        { dataElement: M.dataElements.finalDiagnosis, value: record.diagnosis },
        { dataElement: M.dataElements.lengthOfStayDays, value: String(record.lengthOfStayDays ?? 0) },
      ],
    });
  }

  return {
    trackedEntities: [
      {
        trackedEntity: record.teiId,
        trackedEntityType: M.tetPatient,
        orgUnit: orgUnitUid,
        attributes: [
          { attribute: 'ATTR_NAME', value: record.patientName },
          { attribute: 'ATTR_MRN', value: record.hospitalNumber },
        ],
        enrollments: [
          {
            enrollment: record.enrollmentId,
            program: M.programInpatient,
            orgUnit: orgUnitUid,
            enrolledAt: record.admittedAt,
            occurredAt: record.admittedAt,
            status: record.status,
            events,
          },
        ],
      },
    ],
  };
}
