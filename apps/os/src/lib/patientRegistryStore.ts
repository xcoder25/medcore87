import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
/**
 * Facility patient registry — realtime local + optional Firestore mirror.
 * No seed/demo patients.
 */
export const PATIENT_REGISTRY_KEY = 'medcore_os_patient_registry_v1';

export type PatientSex = 'Male' | 'Female' | 'Other';

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
}

function readAll(): FacilityPatient[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PATIENT_REGISTRY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: FacilityPatient[]) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify(list);
  // localStorage ~5MB; keep headroom for bills/visits
  if (payload.length > 4_500_000) {
    console.warn(
      `[MedCore] Patient registry ~${(payload.length / 1e6).toFixed(1)}MB — nearing browser storage limit. Prefer Firestore for multi-thousand archives.`
    );
  }
  try {
    localStorage.setItem(PATIENT_REGISTRY_KEY, payload);
  } catch (e) {
    console.error('[MedCore] Patient registry write failed (quota?).', e);
    throw e;
  }
  window.dispatchEvent(new CustomEvent('medcore-patients-updated', { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: PATIENT_REGISTRY_KEY } }));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  // Sync summary only on bus (not full 10k dump to every tab every time)
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
  return readAll().find((p) => p.id === id || p.hospitalNumber === id);
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
export function searchPatients(
  facilityId: string,
  query: string,
  limit = 50
): FacilityPatient[] {
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
  writeAll([]);
}
