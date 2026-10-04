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
  localStorage.setItem(PATIENT_REGISTRY_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent('medcore-patients-updated', { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: PATIENT_REGISTRY_KEY } }));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  publishFacilityData(fid, FACILITY_KEYS.patients, list);
  try {
    const bc = new BroadcastChannel('medcore_patients');
    bc.postMessage({ type: 'patients', list });
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
  // Cloud mirror (non-blocking)
  void (async () => {
    try {
      const { firestoreWriteFacility } = await import('./firebase');
      await firestoreWriteFacility(patient.facilityId, {
        patients: listPatients(patient.facilityId),
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
