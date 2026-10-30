/**
 * Clinical bed census — patient placement IDs shared across Nursing, Theatre, Maternity. Not facilities/CMMS.
 * Storage: IndexedDB (async) with in-memory cache. Non-blocking writes prevent UI stutter during busy wards.
 */
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
import { idbGet, idbSet } from './idb';
import {
  syncTrackerFromBedRecord,
  clearBedTurnover,
  formatStandardBedKey,
} from './dhis2TrackerBedBridge';

export type BedStatus = 'occupied' | 'available' | 'maintenance' | 'isolation' | 'reserved' | 'cleaning';

export interface BedRecord {
  id: string;
  facilityId: string;
  ward: string;
  bedNo: string;
  status: BedStatus;
  patient?: string;
  patientId?: string;
  hospitalNumber?: string;
  admitDate?: string;
  /** ISO timestamp of admission */
  admitAt?: string;
  /** Planned discharge YYYY-MM-DD */
  expectedDischarge?: string;
  doctor?: string;
  diagnosis?: string;
  isolationType?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface BedAuditEntry {
  id: string;
  facilityId: string;
  bedId: string;
  bedNo: string;
  ward: string;
  action: 'admit' | 'discharge' | 'transfer' | 'status' | 'create' | 'edit' | 'delete' | 'expected_discharge';
  actor: string;
  detail: string;
  at: string;
  patient?: string;
}

const KEY = 'medcore_os_bed_board_v1';
const AUDIT_KEY = 'medcore_os_bed_audit_v1';
const EVT = 'medcore-bed-board';

type State = { beds: BedRecord[] };

let _state: State | null = null;
let _audit: BedAuditEntry[] | null = null;

function load(): State {
  if (_state !== null) return _state;
  if (typeof window === 'undefined') return { beds: [] };
  try {
    const raw = localStorage.getItem(KEY);
    _state = raw ? JSON.parse(raw) : { beds: [] };
    if (!Array.isArray(_state!.beds)) _state = { beds: [] };
    return _state!;
  } catch {
    _state = { beds: [] };
    return _state;
  }
}

/** Pre-warm from IndexedDB after login */
export async function hydrateBedBoard(): Promise<void> {
  const [s, a] = await Promise.all([
    idbGet<State>('bed_board', 'state'),
    idbGet<BedAuditEntry[]>('bed_audit', 'all'),
  ]);
  if (s && Array.isArray(s.beds)) _state = s;
  if (a && Array.isArray(a)) _audit = a;
}

function save(state: State) {
  if (typeof window === 'undefined') return;
  _state = state;
  // Non-blocking async write — does not stall the main thread
  idbSet('bed_board', 'state', state).catch(() =>
    localStorage.setItem(KEY, JSON.stringify(state)) // fallback
  );
  window.dispatchEvent(new CustomEvent(EVT, { detail: state }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  const fid = state.beds[0]?.facilityId || 'IGH-EKT';
  publishFacilityData(fid, FACILITY_KEYS.beds, state);
}

function loadAudit(): BedAuditEntry[] {
  if (_audit !== null) return _audit;
  if (typeof window === 'undefined') return [];
  try {
    _audit = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
    return _audit!;
  } catch {
    _audit = [];
    return _audit;
  }
}

function pushAudit(entry: Omit<BedAuditEntry, 'id' | 'at'>) {
  if (typeof window === 'undefined') return;
  const row: BedAuditEntry = {
    ...entry,
    id: `BA-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
  };
  _audit = [row, ...loadAudit()].slice(0, 2000);
  // Async write — non-blocking
  idbSet('bed_audit', 'all', _audit).catch(() =>
    localStorage.setItem(AUDIT_KEY, JSON.stringify(_audit))
  );
  window.dispatchEvent(new CustomEvent(EVT));
}

export function listBedAudit(facilityId: string, bedId?: string): BedAuditEntry[] {
  return loadAudit().filter((a) => a.facilityId === facilityId && (!bedId || a.bedId === bedId));
}

export function listBeds(facilityId: string): BedRecord[] {
  return load().beds.filter((b) => b.facilityId === facilityId);
}

export function getBed(bedId: string): BedRecord | undefined {
  return load().beds.find((b) => b.id === bedId);
}

export function listWards(facilityId: string): string[] {
  return Array.from(new Set(listBeds(facilityId).map((b) => b.ward))).sort();
}

export function bedsByWard(facilityId: string, ward: string): BedRecord[] {
  return listBeds(facilityId).filter((b) => b.ward === ward);
}

/** Shared API for Nursing e-MAR, Theatre PACU, Maternity */
export function occupiedBeds(facilityId: string): BedRecord[] {
  return listBeds(facilityId).filter((b) => b.status === 'occupied' || b.status === 'isolation');
}

export function availableBeds(facilityId: string, ward?: string): BedRecord[] {
  return listBeds(facilityId).filter(
    (b) => b.status === 'available' && (!ward || b.ward === ward)
  );
}

export function ensureDefaultBeds(facilityId: string): BedRecord[] {
  const state = load();
  const existing = state.beds.filter((b) => b.facilityId === facilityId);
  if (existing.length > 0) return existing;

  const wards: { ward: string; prefix: string; n: number }[] = [
    { ward: 'Male Medical', prefix: 'MM', n: 8 },
    { ward: 'Female Medical', prefix: 'FM', n: 8 },
    { ward: 'Surgical', prefix: 'SG', n: 6 },
    { ward: 'Paediatrics', prefix: 'PD', n: 4 },
    { ward: 'Maternity', prefix: 'MT', n: 4 },
    { ward: 'ICU', prefix: 'ICU', n: 4 },
    { ward: 'PACU', prefix: 'PACU', n: 4 },
  ];
  const now = new Date().toISOString();
  const beds: BedRecord[] = [];
  for (const w of wards) {
    for (let i = 1; i <= w.n; i++) {
      const bedNo = `${w.prefix}-${String(i).padStart(2, '0')}`;
      beds.push({
        id: `${facilityId}-${bedNo}`,
        facilityId,
        ward: w.ward,
        bedNo,
        status: 'available',
        updatedAt: now,
      });
    }
  }
  state.beds = [...beds, ...state.beds.filter((b) => b.facilityId !== facilityId)];
  save(state);
  pushAudit({
    facilityId,
    bedId: '*',
    bedNo: '—',
    ward: 'All',
    action: 'create',
    actor: 'System',
    detail: `Seeded ${beds.length} default beds`,
  });
  return beds;
}

export function createBeds(input: {
  facilityId: string;
  ward: string;
  prefix: string;
  count: number;
  startFrom?: number;
  actor?: string;
}): BedRecord[] {
  const state = load();
  const start = input.startFrom ?? 1;
  const now = new Date().toISOString();
  const created: BedRecord[] = [];
  for (let i = 0; i < input.count; i++) {
    const n = start + i;
    const bedNo = `${input.prefix}-${String(n).padStart(2, '0')}`;
    const id = `${input.facilityId}-${bedNo}`;
    if (state.beds.some((b) => b.id === id)) continue;
    const bed: BedRecord = {
      id,
      facilityId: input.facilityId,
      ward: input.ward.trim(),
      bedNo,
      status: 'available',
      updatedAt: now,
      updatedBy: input.actor,
    };
    state.beds.push(bed);
    created.push(bed);
  }
  save(state);
  if (created.length) {
    pushAudit({
      facilityId: input.facilityId,
      bedId: created[0].id,
      bedNo: created.map((c) => c.bedNo).join(','),
      ward: input.ward,
      action: 'create',
      actor: input.actor || 'Staff',
      detail: `Created ${created.length} bed(s) in ${input.ward}`,
    });
  }
  return created;
}

export function updateBedMeta(
  bedId: string,
  patch: Partial<Pick<BedRecord, 'ward' | 'bedNo' | 'status' | 'isolationType'>>,
  actor?: string
) {
  const state = load();
  const i = state.beds.findIndex((b) => b.id === bedId);
  if (i < 0) return;
  const prev = state.beds[i];
  state.beds[i] = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: actor,
  };
  save(state);
  pushAudit({
    facilityId: prev.facilityId,
    bedId,
    bedNo: state.beds[i].bedNo,
    ward: state.beds[i].ward,
    action: 'edit',
    actor: actor || 'Staff',
    detail: `Updated bed meta ${JSON.stringify(patch)}`,
  });
}

export function deleteBed(bedId: string, actor?: string) {
  const state = load();
  const bed = state.beds.find((b) => b.id === bedId);
  if (!bed || bed.status === 'occupied' || bed.status === 'isolation') return false;
  state.beds = state.beds.filter((b) => b.id !== bedId);
  save(state);
  pushAudit({
    facilityId: bed.facilityId,
    bedId,
    bedNo: bed.bedNo,
    ward: bed.ward,
    action: 'delete',
    actor: actor || 'Staff',
    detail: 'Bed removed from board',
  });
  return true;
}

export function upsertBed(bed: BedRecord) {
  const state = load();
  const i = state.beds.findIndex((b) => b.id === bed.id);
  if (i >= 0) state.beds[i] = bed;
  else state.beds.unshift(bed);
  save(state);
}

export function admitToBed(
  bedId: string,
  input: {
    patient: string;
    patientId?: string;
    hospitalNumber?: string;
    doctor?: string;
    diagnosis?: string;
    expectedDischarge?: string;
    actor?: string;
    isolation?: boolean;
  }
) {
  const state = load();
  const bed = state.beds.find((b) => b.id === bedId);
  if (!bed) return;
  const now = new Date().toISOString();
  state.beds = state.beds.map((b) =>
    b.id === bedId
      ? {
          ...b,
          status: (input.isolation ? 'isolation' : 'occupied') as BedStatus,
          patient: input.patient,
          patientId: input.patientId,
          hospitalNumber: input.hospitalNumber,
          doctor: input.doctor,
          diagnosis: input.diagnosis || 'Admitted',
          admitDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          admitAt: now,
          expectedDischarge: input.expectedDischarge,
          updatedAt: now,
          updatedBy: input.actor,
        }
      : b
  );
  save(state);
  pushAudit({
    facilityId: bed.facilityId,
    bedId,
    bedNo: bed.bedNo,
    ward: bed.ward,
    action: 'admit',
    actor: input.actor || 'Staff',
    detail: `Admitted ${input.patient}${input.expectedDischarge ? ` · EDD ${input.expectedDischarge}` : ''}`,
    patient: input.patient,
  });

  // Automatically sync to DHIS2 Tracker Inpatient Enrollment
  syncTrackerFromBedRecord({
    facilityId: bed.facilityId,
    ward: bed.ward,
    bedNo: bed.bedNo,
    status: input.isolation ? 'isolation' : 'occupied',
    patient: input.patient,
    hospitalNumber: input.hospitalNumber,
    doctor: input.doctor,
    diagnosis: input.diagnosis,
    admitAt: now,
  });
}

export function setExpectedDischarge(bedId: string, date: string, actor?: string) {
  const state = load();
  const bed = state.beds.find((b) => b.id === bedId);
  if (!bed) return;
  state.beds = state.beds.map((b) =>
    b.id === bedId
      ? { ...b, expectedDischarge: date, updatedAt: new Date().toISOString(), updatedBy: actor }
      : b
  );
  save(state);
  pushAudit({
    facilityId: bed.facilityId,
    bedId,
    bedNo: bed.bedNo,
    ward: bed.ward,
    action: 'expected_discharge',
    actor: actor || 'Staff',
    detail: `Expected discharge set to ${date}`,
    patient: bed.patient,
  });
}

export function dischargeBed(bedId: string, actor?: string) {
  const state = load();
  const bed = state.beds.find((b) => b.id === bedId);
  if (!bed) return;
  const patient = bed.patient;
  state.beds = state.beds.map((b) =>
    b.id === bedId
      ? {
          ...b,
          status: 'cleaning' as const,
          patient: undefined,
          patientId: undefined,
          hospitalNumber: undefined,
          doctor: undefined,
          diagnosis: undefined,
          admitDate: undefined,
          admitAt: undefined,
          expectedDischarge: undefined,
          isolationType: undefined,
          updatedAt: new Date().toISOString(),
          updatedBy: actor,
        }
      : b
  );
  save(state);
  pushAudit({
    facilityId: bed.facilityId,
    bedId,
    bedNo: bed.bedNo,
    ward: bed.ward,
    action: 'discharge',
    actor: actor || 'Staff',
    detail: `Discharged ${patient || 'patient'} · bed set to cleaning`,
    patient,
  });

  // Automatically complete DHIS2 Tracker enrollment & trigger 2h turnover
  syncTrackerFromBedRecord({
    facilityId: bed.facilityId,
    ward: bed.ward,
    bedNo: bed.bedNo,
    status: 'cleaning',
  });
}

export function setBedStatus(bedId: string, status: BedStatus, actor?: string) {
  const state = load();
  const bed = state.beds.find((b) => b.id === bedId);
  if (!bed) return;
  state.beds = state.beds.map((b) =>
    b.id === bedId
      ? { ...b, status, updatedAt: new Date().toISOString(), updatedBy: actor }
      : b
  );
  save(state);
  pushAudit({
    facilityId: bed.facilityId,
    bedId,
    bedNo: bed.bedNo,
    ward: bed.ward,
    action: 'status',
    actor: actor || 'Staff',
    detail: `Status → ${status}`,
    patient: bed.patient,
  });

  if (status === 'available') {
    clearBedTurnover(formatStandardBedKey(bed.ward, 'RM01', bed.bedNo));
  }
}

/** Transfer patient from one bed to another (same board IDs) */
export function transferPatient(
  fromBedId: string,
  toBedId: string,
  actor?: string
): { ok: boolean; message: string } {
  const state = load();
  const from = state.beds.find((b) => b.id === fromBedId);
  const to = state.beds.find((b) => b.id === toBedId);
  if (!from || !to) return { ok: false, message: 'Bed not found' };
  if (from.status !== 'occupied' && from.status !== 'isolation') {
    return { ok: false, message: 'Source bed has no patient' };
  }
  if (to.status !== 'available' && to.status !== 'cleaning') {
    return { ok: false, message: 'Target bed not available' };
  }
  const now = new Date().toISOString();
  state.beds = state.beds.map((b) => {
    if (b.id === toBedId) {
      return {
        ...b,
        status: from.status === 'isolation' ? ('isolation' as const) : ('occupied' as const),
        patient: from.patient,
        patientId: from.patientId,
        hospitalNumber: from.hospitalNumber,
        doctor: from.doctor,
        diagnosis: from.diagnosis,
        admitDate: from.admitDate,
        admitAt: from.admitAt,
        expectedDischarge: from.expectedDischarge,
        isolationType: from.isolationType,
        updatedAt: now,
        updatedBy: actor,
      };
    }
    if (b.id === fromBedId) {
      return {
        ...b,
        status: 'cleaning' as const,
        patient: undefined,
        patientId: undefined,
        hospitalNumber: undefined,
        doctor: undefined,
        diagnosis: undefined,
        admitDate: undefined,
        admitAt: undefined,
        expectedDischarge: undefined,
        isolationType: undefined,
        updatedAt: now,
        updatedBy: actor,
      };
    }
    return b;
  });
  save(state);
  pushAudit({
    facilityId: from.facilityId,
    bedId: toBedId,
    bedNo: `${from.bedNo}→${to.bedNo}`,
    ward: `${from.ward}→${to.ward}`,
    action: 'transfer',
    actor: actor || 'Staff',
    detail: `Transferred ${from.patient} from ${from.bedNo} (${from.ward}) to ${to.bedNo} (${to.ward})`,
    patient: from.patient,
  });

  // Sync transfer across DHIS2 Tracker
  syncTrackerFromBedRecord({
    facilityId: from.facilityId,
    ward: from.ward,
    bedNo: from.bedNo,
    status: 'cleaning',
  });
  syncTrackerFromBedRecord({
    facilityId: to.facilityId,
    ward: to.ward,
    bedNo: to.bedNo,
    status: from.status === 'isolation' ? 'isolation' : 'occupied',
    patient: from.patient,
    hospitalNumber: from.hospitalNumber,
    doctor: from.doctor,
    diagnosis: from.diagnosis,
    admitAt: from.admitAt,
  });

  return { ok: true, message: `Transferred to ${to.bedNo}` };
}

/** @deprecated prefer transferPatient */
export function transferBedWard(bedId: string, ward: string, actor?: string) {
  updateBedMeta(bedId, { ward: ward.trim() }, actor);
}

export function losDays(bed: BedRecord): number | null {
  if (!bed.admitAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(bed.admitAt).getTime()) / 86400000));
}

export interface WardAlert {
  id: string;
  level: 'critical' | 'warn' | 'info';
  ward?: string;
  message: string;
}

export function bedOccupancyAlerts(facilityId: string): WardAlert[] {
  const beds = listBeds(facilityId);
  const alerts: WardAlert[] = [];
  const wards = listWards(facilityId);

  for (const ward of wards) {
    const wb = beds.filter((b) => b.ward === ward);
    const occ = wb.filter((b) => b.status === 'occupied' || b.status === 'isolation').length;
    const pct = wb.length ? Math.round((occ / wb.length) * 100) : 0;
    if (pct >= 90) {
      alerts.push({
        id: `occ-${ward}`,
        level: 'critical',
        ward,
        message: `${ward} at ${pct}% occupancy (${occ}/${wb.length})`,
      });
    } else if (pct >= 80) {
      alerts.push({
        id: `occ-w-${ward}`,
        level: 'warn',
        ward,
        message: `${ward} elevated occupancy ${pct}%`,
      });
    }
    const iso = wb.filter((b) => b.status === 'isolation').length;
    const isoCap = wb.filter((b) => b.status === 'isolation' || b.status === 'available').length;
    if (iso > 0 && iso >= Math.max(1, Math.floor(wb.length * 0.25))) {
      alerts.push({
        id: `iso-${ward}`,
        level: 'warn',
        ward,
        message: `${ward}: ${iso} isolation bed(s) in use — capacity pressure`,
      });
    }
  }

  for (const b of beds) {
    const los = losDays(b);
    if (los != null && los >= 14 && (b.status === 'occupied' || b.status === 'isolation')) {
      alerts.push({
        id: `los-${b.id}`,
        level: 'warn',
        ward: b.ward,
        message: `Long stay: ${b.patient} on ${b.bedNo} · ${los} days`,
      });
    }
  }

  return alerts;
}

export function dailyCensus(facilityId: string) {
  const beds = listBeds(facilityId);
  return {
    date: new Date().toISOString().slice(0, 10),
    total: beds.length,
    occupied: beds.filter((b) => b.status === 'occupied').length,
    isolation: beds.filter((b) => b.status === 'isolation').length,
    available: beds.filter((b) => b.status === 'available').length,
    cleaning: beds.filter((b) => b.status === 'cleaning').length,
    maintenance: beds.filter((b) => b.status === 'maintenance').length,
    rows: beds.map((b) => ({
      ward: b.ward,
      bedNo: b.bedNo,
      status: b.status,
      patient: b.patient || '',
      hospitalNumber: b.hospitalNumber || '',
      doctor: b.doctor || '',
      diagnosis: b.diagnosis || '',
      admitDate: b.admitDate || '',
      expectedDischarge: b.expectedDischarge || '',
      losDays: losDays(b),
    })),
  };
}

export function exportCensusCsv(facilityId: string): string {
  const c = dailyCensus(facilityId);
  const header =
    'Ward,Bed,Status,Patient,HospitalNo,Doctor,Diagnosis,Admitted,ExpectedDischarge,LOS_Days';
  const lines = c.rows.map(
    (r) =>
      `"${r.ward}","${r.bedNo}","${r.status}","${r.patient}","${r.hospitalNumber}","${r.doctor}","${r.diagnosis}","${r.admitDate}","${r.expectedDischarge}","${r.losDays ?? ''}"`
  );
  return [header, ...lines].join('\n');
}

export function subscribeBeds(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('medcore-data-reset', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('medcore-data-reset', fn);
  };
}

export function resetBedBoard() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(AUDIT_KEY);
  window.dispatchEvent(new CustomEvent(EVT, { detail: { beds: [] } }));
}

export const BED_BOARD_KEY = KEY;
export const BED_AUDIT_KEY = AUDIT_KEY;

/**
 * Global Bridge Listener: Synchronize actions initiated inside the DHIS2 Tracker Bed Board Suite
 * back to MedCore's clinical bed census.
 */
let _bridgeListenerRegistered = false;
if (typeof window !== 'undefined' && !_bridgeListenerRegistered) {
  _bridgeListenerRegistered = true;
  window.addEventListener('medcore-bed-sync-bridge', (e: any) => {
    const detail = e.detail;
    if (!detail) return;
    const { action, record, bedKey } = detail;
    const state = load();

    if (action === 'admit' && record) {
      // Find matching bed in store by ward + bed
      const match = state.beds.find(
        (b) =>
          b.facilityId === record.facilityId &&
          (b.ward.toLowerCase() === record.ward.toLowerCase() ||
            formatStandardBedKey(b.ward, 'RM01', b.bedNo) === record.bedKey)
      );
      if (match && match.status !== 'occupied') {
        state.beds = state.beds.map((b) =>
          b.id === match.id
            ? {
                ...b,
                status: 'occupied' as const,
                patient: record.patientName,
                hospitalNumber: record.hospitalNumber,
                diagnosis: record.diagnosis,
                doctor: record.doctor,
                admitDate: new Date(record.admittedAt).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }),
                admitAt: record.admittedAt,
                updatedAt: new Date().toISOString(),
              }
            : b
        );
        save(state);
      }
    } else if (action === 'discharge' && record) {
      const match = state.beds.find(
        (b) =>
          b.facilityId === record.facilityId &&
          formatStandardBedKey(b.ward, 'RM01', b.bedNo) === record.bedKey
      );
      if (match) {
        state.beds = state.beds.map((b) =>
          b.id === match.id
            ? {
                ...b,
                status: 'cleaning' as const,
                patient: undefined,
                hospitalNumber: undefined,
                diagnosis: undefined,
                admitDate: undefined,
                admitAt: undefined,
                updatedAt: new Date().toISOString(),
              }
            : b
        );
        save(state);
      }
    } else if (action === 'clean' && bedKey) {
      const match = state.beds.find(
        (b) => formatStandardBedKey(b.ward, 'RM01', b.bedNo) === bedKey
      );
      if (match && match.status === 'cleaning') {
        state.beds = state.beds.map((b) =>
          b.id === match.id
            ? {
                ...b,
                status: 'available' as const,
                updatedAt: new Date().toISOString(),
              }
            : b
        );
        save(state);
      }
    }
  });
}

