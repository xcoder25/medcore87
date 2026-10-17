/**
 * DHIS2 Tracker & Simulated Bed Management Bridge
 *
 * Implements:
 * 1. Tracked Entity Type (Patient) & Inpatient Program metadata structure
 * 2. Three Program Stages: Admission, Clinical Care/Daily Vitals, Discharge
 * 3. Standardized location string convention: WARD-ROOM-BED (e.g. ICU-RM102-B1)
 * 4. Program Stage cross-referencing logic for simulated real-time bed states:
 *    - Green (Available): Bed ID has no active enrollment or recent discharge
 *    - Red (Occupied): Active enrollment with incomplete discharge
 *    - Yellow (Cleaning/Turnover): Discharge completed within last 2 hours (turnover window)
 * 5. DHIS2 Web API payload generators & exportable metadata package
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

export type SimulatedBedState = 'available' | 'occupied' | 'cleaning';

export interface SimulatedBedStatus {
  bedKey: string;
  ward: string;
  room: string;
  bed: string;
  state: SimulatedBedState;
  stateLabel: 'Available' | 'Occupied' | 'Cleaning / Turnover';
  color: string;
  patient?: {
    teiId: string;
    enrollmentId: string;
    patientName: string;
    hospitalNumber: string;
    admittedAt: string;
    diagnosis?: string;
    priority?: string;
    eventId: string;
  };
  discharge?: {
    dischargedAt: string;
    outcome: string;
    minutesSinceDischarge: number;
  };
}

// ─── DHIS2 METADATA CONSTANTS ──────────────────────────────────────────────────
export const DHIS2_INPATIENT_METADATA = {
  tetPatient: 'TET_PATIENT_01',
  programInpatient: 'PRG_INPATIENT_MGT',
  stages: {
    admission: 'STG_ADMISSION_01',
    clinicalCare: 'STG_CLINICAL_CARE_02',
    discharge: 'STG_DISCHARGE_03',
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
    // Stage 2: Clinical Care / Daily Vitals (Repeatable)
    vitalBpSystolic: 'DE_VIT_BP_SYS',
    vitalBpDiastolic: 'DE_VIT_BP_DIA',
    vitalPulse: 'DE_VIT_PULSE',
    vitalTemp: 'DE_VIT_TEMP',
    vitalSpo2: 'DE_VIT_SPO2',
    progressNote: 'DE_PROG_NOTE',
    medicationGiven: 'DE_MED_ADMIN',
    // Stage 3: Discharge
    dischargeDate: 'DE_DIS_DATE',
    dischargeOutcome: 'DE_DIS_OUTCOME', // discharged, referred, deceased
    finalDiagnosis: 'DE_FINAL_DIAG',
  },
};

const STORAGE_KEY = 'medcore_dhis2_simulated_tracker_v1';
const EVT_NAME = 'medcore-dhis2-tracker-updated';

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
    .replace(/[^A-Z0-9]/g, '');

  const cleanRoom = room.toUpperCase().startsWith('RM')
    ? room.toUpperCase().replace(/[^A-Z0-9]/g, '')
    : `RM${room.toUpperCase().replace(/[^0-9]/g, '') || '01'}`;

  const cleanBed = bed.toUpperCase().replace(/^BED\s*/i, 'B').replace(/[^A-Z0-9]/g, '');

  return `${cleanWard}-${cleanRoom}-${cleanBed}`;
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
  priority: 'routine' | 'urgent' | 'emergency';
  admissionEventId: string;
  status: 'ACTIVE' | 'COMPLETED';
  dischargedAt?: string;
  dischargeOutcome?: 'discharged' | 'referred' | 'deceased';
  dischargeEventId?: string;
  vitalsEvents: Array<{
    id: string;
    at: string;
    bp?: string;
    pulse?: number;
    temp?: number;
    spo2?: number;
    notes?: string;
  }>;
}

function readStore(): InpatientTrackerRecord[] {
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

function saveStore(data: InpatientTrackerRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(EVT_NAME, { detail: data }));
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

/**
 * Calculates current real-time simulated bed board states based on active DHIS2 Tracker enrollments:
 * - Green (Available): Bed ID is empty in current active patient list and no discharge within 2 hours.
 * - Red (Occupied): Active enrollment where Discharge Stage is incomplete.
 * - Yellow (Cleaning/Turnover): Patient discharged within turnover window (default 2 hours).
 */
export function calculateSimulatedBedBoard(
  facilityId: string,
  turnoverWindowHours: number = 2
): SimulatedBedStatus[] {
  const records = readStore().filter((r) => r.facilityId === facilityId);
  const now = Date.now();
  const turnoverMs = turnoverWindowHours * 60 * 60 * 1000;

  return DEFAULT_HOSPITAL_BED_KEYS.map((loc) => {
    // 1. Check for active enrollment (Occupied)
    const active = records.find(
      (r) => r.bedKey === loc.standardKey && r.status === 'ACTIVE'
    );

    if (active) {
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
          eventId: active.admissionEventId,
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
    priority: input.priority || 'routine',
    admissionEventId,
    status: 'ACTIVE',
    vitalsEvents: [],
  };

  const store = readStore();
  // Clear any existing active admission on this bed
  const filtered = store.filter((r) => !(r.bedKey === standardKey && r.status === 'ACTIVE'));
  saveStore([record, ...filtered]);
  return record;
}

/**
 * Update Bed/Location
 * Updates patient's bed location via event update (PUT /api/tracker/events/{eventId}).
 */
export function transferPatientBedTracker(
  enrollmentId: string,
  newWard: string,
  newRoom: string,
  newBed: string
): boolean {
  const store = readStore();
  const idx = store.findIndex((r) => r.enrollmentId === enrollmentId && r.status === 'ACTIVE');
  if (idx < 0) return false;

  const newKey = formatStandardBedKey(newWard, newRoom, newBed);
  store[idx].ward = newWard;
  store[idx].room = newRoom;
  store[idx].bed = newBed;
  store[idx].bedKey = newKey;
  saveStore(store);
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
    notes?: string;
  }
): boolean {
  const store = readStore();
  const idx = store.findIndex((r) => r.enrollmentId === enrollmentId && r.status === 'ACTIVE');
  if (idx < 0) return false;

  store[idx].vitalsEvents.push({
    id: `EVT-VIT-${Date.now().toString(36).toUpperCase()}`,
    at: new Date().toISOString(),
    ...vitals,
  });
  saveStore(store);
  return true;
}

/**
 * Stage 3: Discharge / Free Bed
 * Completes the enrollment via PUT /api/tracker/enrollments/{enrollmentId} (status: COMPLETED).
 * Immediately triggers the 2-hour Turnover / Cleaning state (Yellow).
 */
export function dischargePatientTracker(
  enrollmentId: string,
  outcome: 'discharged' | 'referred' | 'deceased' = 'discharged'
): boolean {
  const store = readStore();
  const idx = store.findIndex((r) => r.enrollmentId === enrollmentId && r.status === 'ACTIVE');
  if (idx < 0) return false;

  store[idx].status = 'COMPLETED';
  store[idx].dischargedAt = new Date().toISOString();
  store[idx].dischargeOutcome = outcome;
  store[idx].dischargeEventId = `EVT-DIS-${Date.now().toString(36).toUpperCase()}`;

  saveStore(store);
  return true;
}

/** Mark turnover completed early (turn yellow bed back to green) */
export function clearBedTurnover(bedKey: string): boolean {
  const store = readStore();
  // Clear any recent discharge matching this bedKey so it returns to green immediately
  const updated = store.map((r) => {
    if (r.bedKey === bedKey && r.status === 'COMPLETED') {
      return { ...r, dischargedAt: new Date(Date.now() - 24 * 3600000).toISOString() };
    }
    return r;
  });
  saveStore(updated);
  return true;
}

export function subscribeDhis2Tracker(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVT_NAME, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVT_NAME, cb);
    window.removeEventListener('storage', cb);
  };
}

/**
 * Generates the complete DHIS2 Tracker Inpatient Management metadata JSON package
 * ready for import into DHIS2 instances via /api/metadata.
 */
export function buildDhis2MetadataPackage() {
  const M = DHIS2_INPATIENT_METADATA;

  return {
    trackedEntityTypes: [
      {
        id: M.tetPatient,
        name: 'Patient',
        description: 'Individual registered in the health facility EMR',
      },
    ],
    dataElements: [
      { id: M.dataElements.admissionDate, name: 'Inpatient - Admission Date', valueType: 'DATETIME', domainType: 'TRACKER' },
      { id: M.dataElements.admittingDiagnosis, name: 'Inpatient - Admitting Diagnosis', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.triagePriority, name: 'Inpatient - Triage Priority', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.ward, name: 'Inpatient - Ward', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.roomNumber, name: 'Inpatient - Room Number', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.bedNumber, name: 'Inpatient - Bed Number', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.standardBedKey, name: 'Inpatient - Standard Bed Key (WARD-ROOM-BED)', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.vitalBpSystolic, name: 'Inpatient - BP Systolic', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.vitalBpDiastolic, name: 'Inpatient - BP Diastolic', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.vitalPulse, name: 'Inpatient - Pulse Rate', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.vitalTemp, name: 'Inpatient - Temperature C', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.vitalSpo2, name: 'Inpatient - SpO2 %', valueType: 'NUMBER', domainType: 'TRACKER' },
      { id: M.dataElements.progressNote, name: 'Inpatient - Clinical Progress Note', valueType: 'LONG_TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.dischargeDate, name: 'Inpatient - Discharge Date', valueType: 'DATETIME', domainType: 'TRACKER' },
      { id: M.dataElements.dischargeOutcome, name: 'Inpatient - Discharge Outcome', valueType: 'TEXT', domainType: 'TRACKER' },
      { id: M.dataElements.finalDiagnosis, name: 'Inpatient - Final Diagnosis', valueType: 'TEXT', domainType: 'TRACKER' },
    ],
    programs: [
      {
        id: M.programInpatient,
        name: 'Inpatient Management',
        shortName: 'Inpatient Tracker',
        programType: 'WITH_REGISTRATION',
        trackedEntityType: { id: M.tetPatient },
        programStages: [
          {
            id: M.stages.admission,
            name: 'Stage 1: Admission',
            repeatable: false,
            programStageDataElements: [
              { dataElement: { id: M.dataElements.admissionDate }, compulsory: true },
              { dataElement: { id: M.dataElements.admittingDiagnosis }, compulsory: true },
              { dataElement: { id: M.dataElements.triagePriority }, compulsory: true },
              { dataElement: { id: M.dataElements.ward }, compulsory: true },
              { dataElement: { id: M.dataElements.roomNumber }, compulsory: true },
              { dataElement: { id: M.dataElements.bedNumber }, compulsory: true },
              { dataElement: { id: M.dataElements.standardBedKey }, compulsory: true },
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
              { dataElement: { id: M.dataElements.progressNote }, compulsory: false },
            ],
          },
          {
            id: M.stages.discharge,
            name: 'Stage 3: Discharge',
            repeatable: false,
            programStageDataElements: [
              { dataElement: { id: M.dataElements.dischargeDate }, compulsory: true },
              { dataElement: { id: M.dataElements.dischargeOutcome }, compulsory: true },
              { dataElement: { id: M.dataElements.finalDiagnosis }, compulsory: true },
            ],
          },
        ],
      },
    ],
  };
}
