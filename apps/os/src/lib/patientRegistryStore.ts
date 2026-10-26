import { apiUpsertPatient } from './db/clientApi';
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
import { idbGet, idbSet } from './idb';
/**
 * Facility patient registry — realtime local + optional Firestore mirror.
 * Storage: IndexedDB (async, no 5MB cap) with in-memory cache for sync callers.
 */
export const PATIENT_REGISTRY_KEY = 'medcore_os_patient_registry_v1';
const IDB_STORE = 'patient_registry' as const;
const IDB_KEY = 'all';

export type PatientSex = 'Male' | 'Female' | 'Other';

/** @deprecated alias — use FacilityPatient */
export type RegisteredPatient = FacilityPatient;

export interface FacilityPatient {
  id: string;
  /** Hospital folder / card number */
  hospitalNumber: string;
  nhiaNumber?: string;
  nin?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dob: string;
  sex: PatientSex;
  phone: string;
  email?: string;
  address?: string;
  state?: string;
  lga?: string;
  bloodGroup?: string;
  genotype?: string;
  emergencyContact?: string;
  emergencyRelation?: string;
  occupation?: string;
  photoUrl?: string;
  facilityId: string;
  facilityName: string;
  category?: string;
  insuranceProvider?: string;
  insuranceId?: string;
  status: 'active' | 'inactive';
  registeredAt: string;
  lastVisit?: string;
  /** Administrative only — reception should not rely on clinical fields */
  notesAdmin?: string;
  /** Clinical chart fields (authorized roles) */
  allergies?: string[];
  chronicConditions?: string[];
  surgicalHistory?: string;
  familyHistory?: string;
  currentMedications?: string[];
  immunizations?: string;
  problems?: string[];
  /** Statewide Health Card & Interoperability standard fields */
  shid?: string;
  emergencyFlag?: boolean;
  cardIssueDate?: string;
  cardExpiryDate?: string;
  /** Optional cross-module compatibility aliases */
  mrn?: string;
  name?: string;
  gender?: string;
  enrolledAt?: string;
  lastVitals?: {
    bp?: string;
    pulse?: number;
    temp?: number;
    spo2?: number;
  };
}

/** In-memory cache — avoids repeated IDB reads for synchronous callers */
let _cache: FacilityPatient[] | null = null;

/** Async read from IndexedDB (preferred — used on initial hydration) */
async function readAllAsync(): Promise<FacilityPatient[]> {
  if (_cache !== null) return _cache;
  // Try IndexedDB first
  const idbData = await idbGet<FacilityPatient[]>(IDB_STORE, IDB_KEY);
  if (idbData && Array.isArray(idbData)) {
    _cache = idbData;
    return _cache;
  }
  // Fallback: read from localStorage (pre-migration data)
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PATIENT_REGISTRY_KEY);
    _cache = raw ? (JSON.parse(raw) as FacilityPatient[]) : [];
    return _cache;
  } catch {
    _cache = [];
    return _cache;
  }
}

/** Synchronous accessor using in-memory cache */
function readAll(): FacilityPatient[] {
  if (_cache !== null) return _cache;
  // Cold start — read localStorage synchronously (only until first async hydration)
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PATIENT_REGISTRY_KEY);
    _cache = raw ? (JSON.parse(raw) as FacilityPatient[]) : [];
    return _cache;
  } catch {
    _cache = [];
    return _cache;
  }
}

/** Pre-warm the cache from IndexedDB — call once after login */
export async function hydratePatientRegistry(): Promise<void> {
  await readAllAsync();
}

function writeAll(list: FacilityPatient[]) {
  if (typeof window === 'undefined') return;
  _cache = list;
  // Write to IndexedDB asynchronously (non-blocking — no main thread stall)
  idbSet(IDB_STORE, IDB_KEY, list).catch((e) =>
    console.warn('[MedCore] Patient registry IDB write failed:', e)
  );
  window.dispatchEvent(new CustomEvent('medcore-patients-updated', { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: PATIENT_REGISTRY_KEY } }));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  publishFacilityData(fid, FACILITY_KEYS.patients, list.length > 2000 ? list.slice(0, 2000) : list);
  try {
    const bc = new BroadcastChannel('medcore_patients');
    if (list.length <= 2000) {
      bc.postMessage({ type: 'patients', list });
    } else {
      bc.postMessage({ type: 'patients_meta', count: list.length, facilityId: fid });
    }
    bc.close();
  } catch { /* ignore */ }
}

export function listPatients(facilityId?: string): FacilityPatient[] {
  const all = readAll();
  if (!facilityId) return all;
  return all.filter((p) => p.facilityId === facilityId);
}

export function getPatient(id: string): FacilityPatient | undefined {
  const q = (id || '').trim();
  const qDigits = q.replace(/\D/g, '');
  return readAll().find(
    (p) =>
      p.id === q ||
      p.hospitalNumber === q ||
      // Invisible NIN binding — NIN resolves to the same patient as their ID
      (qDigits.length === 11 && (p.nin || '').replace(/\D/g, '') === qDigits)
  );
}

/**
 * Look up a patient by their NIN (invisible binding).
 * Returns undefined if no match — callers must not expose NIN as a "search mode"
 * to end users; NIN resolution should feel transparent.
 */
export function getPatientByNin(nin: string, facilityId?: string): FacilityPatient | undefined {
  const digits = (nin || '').replace(/\D/g, '');
  if (digits.length !== 11) return undefined;
  const all = facilityId ? listPatients(facilityId) : readAll();
  return all.find((p) => (p.nin || '').replace(/\D/g, '') === digits);
}

/**
 * Cross-facility lookup: check if a NIN exists in ANY facility in the registry.
 * Enables federated demographic import when a patient transfers or presents at a new facility.
 */
export function getCrossFacilityPatientByNin(
  nin: string,
  excludeFacilityId?: string
): FacilityPatient | undefined {
  const digits = (nin || '').replace(/\D/g, '');
  if (digits.length !== 11) return undefined;
  const all = readAll();
  return all.find(
    (p) =>
      (p.nin || '').replace(/\D/g, '') === digits &&
      (!excludeFacilityId || p.facilityId !== excludeFacilityId)
  );
}


export function upsertPatient(patient: FacilityPatient): FacilityPatient {
  const all = readAll();
  const next = [patient, ...all.filter((p) => p.id !== patient.id)];
  writeAll(next);
  // Cloud mirror (non-blocking) — single patient upsert, not full registry dump
  void (async () => {
    try {
      const { firestoreWriteFacility } = await import('./firebase');
      const count = listPatients(patient.facilityId).length;
      void apiUpsertPatient({
        id: patient.id,
        facilityId: patient.facilityId,
        facilityName: patient.facilityName,
        fullName: [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' '),
        hospitalNumber: patient.hospitalNumber,
        sex: patient.sex,
        dateOfBirth: patient.dob,
        phone: patient.phone,
        email: patient.email,
        address: patient.address,
      });
      await firestoreWriteFacility(patient.facilityId, {
        [`patient_${patient.id}`]: patient,
        patientsCount: count,
        patientsUpdatedAt: new Date().toISOString(),
      });
    } catch {
      /* offline ok */
    }
  })();
  return patient;
}

export function deletePatient(id: string, facilityId?: string) {
  const all = readAll().filter((p) => p.id !== id);
  writeAll(all);
  if (facilityId) {
    void (async () => {
      try {
        const { firestoreWriteFacility } = await import('./firebase');
        await firestoreWriteFacility(facilityId, {
          patients: listPatients(facilityId),
          patientsUpdatedAt: new Date().toISOString(),
        });
      } catch {
        /* ignore */
      }
    })();
  }
}


/** Count patients for a facility (O(n) scan — OK to ~10k) */
export function countPatients(facilityId: string): number {
  return listPatients(facilityId).length;
}

/**
 * Search patients without rendering the full registry.
 * Default limit 50 — suitable for typeahead at 1,000–10,000 patients.
 */

/** Pull patient list/search from Aurora when configured; merge into local cache. */
export async function hydratePatientsFromPostgres(facilityId: string, q?: string): Promise<number> {
  try {
    const res = await apiListPatients(facilityId, q);
    if (!res?.ok || !Array.isArray(res.patients) || !res.patients.length) return 0;
    const all = readAll();
    const byId = new Map(all.map((p) => [p.id, p]));
    let n = 0;
    for (const row of res.patients as Array<Record<string, unknown>>) {
      const id = String(row.id || '');
      if (!id) continue;
      const name = String(row.full_name || row.fullName || '');
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0] || 'Patient';
      const lastName = parts.slice(1).join(' ') || firstName;
      const sexRaw = String(row.sex || 'Other');
      const sex: PatientSex =
        sexRaw === 'Male' || sexRaw === 'Female' ? sexRaw : 'Other';
      const prev = byId.get(id);
      const next: FacilityPatient = {
        ...(prev || {}),
        id,
        hospitalNumber: String(row.hospital_number || row.hospitalNumber || prev?.hospitalNumber || id),
        firstName,
        lastName,
        dob: String(row.date_of_birth || row.dateOfBirth || prev?.dob || ''),
        sex,
        phone: String(row.phone || prev?.phone || ''),
        email: row.email ? String(row.email) : prev?.email,
        address: row.address ? String(row.address) : prev?.address,
        facilityId,
        facilityName: String(row.facility_name || prev?.facilityName || facilityId),
      };
      byId.set(id, { ...byId.get(id), ...next } as FacilityPatient);
      n++;
    }
    const merged = Array.from(byId.values());
    _cache = merged;
    try {
      localStorage.setItem(PATIENT_REGISTRY_KEY, JSON.stringify(merged));
    } catch { /* */ }
    try {
      window.dispatchEvent(new CustomEvent('medcore-patients-updated'));
    } catch { /* */ }
    return n;
  } catch {
    return 0;
  }
}

export function searchPatients(
  facilityId: string,
  query: string,
  limit = 50
): FacilityPatient[] {
  void hydratePatientsFromPostgres(facilityId, query);

  const q = (query || '').trim().toLowerCase();
  const all = listPatients(facilityId);
  if (!q) {
    // Most recent first (registry stores newest at front on upsert)
    return all.slice(0, limit);
  }
  const out: FacilityPatient[] = [];
  for (const p of all) {
    const blob = [
      p.firstName,
      p.middleName,
      p.lastName,
      p.hospitalNumber,
      p.phone,
      p.nin,
      p.nhiaNumber,
      p.email,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (blob.includes(q)) {
      out.push(p);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Paginated list for admin exports / large desks */
export function listPatientsPage(
  facilityId: string,
  page: number,
  pageSize = 50
): { rows: FacilityPatient[]; total: number; page: number; pageSize: number } {
  const all = listPatients(facilityId);
  const total = all.length;
  const start = Math.max(0, page * pageSize);
  return {
    rows: all.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}

export function getPatientByHospitalNumber(
  facilityId: string,
  hospitalNumber: string
): FacilityPatient | undefined {
  const hn = (hospitalNumber || '').trim().toLowerCase();
  if (!hn) return undefined;
  return listPatients(facilityId).find((p) => p.hospitalNumber.toLowerCase() === hn);
}

/** Scale probe for ops / QA */
export function probePatientRegistryScale(facilityId: string): {
  count: number;
  approxBytes: number;
  approxMb: number;
  localStorageHeadroom: 'ok' | 'tight' | 'critical';
} {
  const all = listPatients(facilityId);
  let approxBytes = 0;
  try {
    approxBytes = new Blob([JSON.stringify(all)]).size;
  } catch {
    approxBytes = JSON.stringify(all).length;
  }
  const approxMb = approxBytes / (1024 * 1024);
  const localStorageHeadroom =
    approxMb < 2 ? 'ok' : approxMb < 4 ? 'tight' : 'critical';
  return { count: all.length, approxBytes, approxMb, localStorageHeadroom };
}

export function generateHospitalNumber(facilityId: string): string {
  const prefix = (facilityId || 'HSP').replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || 'HSP';
  const seq = Date.now().toString(36).toUpperCase().slice(-6);
  return `${prefix}-PT-${seq}`;
}

export function subscribePatients(cb: () => void): () => void {
  const fn = () => cb();
  window.addEventListener('medcore-patients-updated', fn);
  window.addEventListener('medcore-admin-sync', fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener('medcore-patients-updated', fn);
    window.removeEventListener('medcore-admin-sync', fn);
    window.removeEventListener('storage', fn);
  };
}

/** Wipe all local patient records (fresh facility) */
export function resetPatientRegistry() {
  clearAllPatients();
}

/**
 * Completely delete all patients and related patient records (queues, bills, vitals, beds)
 * for a fresh test, notifying all UI components and updating cloud stores.
 */
export function clearAllPatients(facilityId?: string) {
  if (typeof window === 'undefined') return;
  const fid = facilityId || 'IGH-EKT';

  try {
    localStorage.setItem(PATIENT_REGISTRY_KEY, '[]');
  } catch {
    try {
      localStorage.removeItem(PATIENT_REGISTRY_KEY);
    } catch {
      /* ignore */
    }
  }

  // Clear related clinical / queue / billing records tied to patients
  const relatedKeys = [
    'medcore_os_patient_registry_v1',
    'medcore_os_patient_cache_v1',
    'medcore_os_reception_ops_v2',
    'medcore_os_reception_ops_v1',
    'medcore_os_patient_bills_v1',
    'medcore_os_payment_receipts_v1',
    'medcore_os_fd_accounts_requests_v1',
    'medcore_os_clinical_orders_v1',
    'medcore_os_nursing_vitals_v1',
    'medcore_os_bed_board_v1',
    'medcore_os_theatre_cases_v1',
    'medcore_os_delta_events_v1',
    'medcore_os_reconcile_queue_v1',
  ];

  for (const k of relatedKeys) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }

  // Broadcast to all open tabs and active React components
  window.dispatchEvent(new CustomEvent('medcore-patients-updated', { detail: [] }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: PATIENT_REGISTRY_KEY } }));
  window.dispatchEvent(new CustomEvent('medcore-reception-ops', { detail: { visits: [], appointments: [], payments: [] } }));
  window.dispatchEvent(new CustomEvent('medcore-clinical-orders', { detail: [] }));
  window.dispatchEvent(new CustomEvent('medcore-bed-board', { detail: [] }));
  window.dispatchEvent(new CustomEvent('medcore-vitals', { detail: [] }));
  window.dispatchEvent(new CustomEvent('medcore-patient-bills', { detail: [] }));

  try {
    const bc = new BroadcastChannel('medcore_patients');
    bc.postMessage({ type: 'patients', list: [] });
    bc.close();
  } catch {
    /* ignore */
  }

  // Sync to facility hub
  publishFacilityData(fid, FACILITY_KEYS.patients, []);
  publishFacilityData(fid, FACILITY_KEYS.reception, { visits: [], appointments: [], payments: [] });
  publishFacilityData(fid, FACILITY_KEYS.clinical, []);
  publishFacilityData(fid, FACILITY_KEYS.beds, []);
  publishFacilityData(fid, FACILITY_KEYS.vitals, []);

  // Update cloud facility document
  void (async () => {
    try {
      const { firestoreWriteFacility } = await import('./firebase');
      await firestoreWriteFacility(fid, {
        [FACILITY_KEYS.patients]: [],
        patientsCount: 0,
        patientsUpdatedAt: new Date().toISOString(),
      });
    } catch {
      /* ignore */
    }
  })();
}

if (typeof window !== 'undefined') {
  (window as unknown as { __medcoreClearAllPatients?: (fid?: string) => void }).__medcoreClearAllPatients = clearAllPatients;
}

