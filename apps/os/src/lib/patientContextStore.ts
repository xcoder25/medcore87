/**
 * Global "patient in context" — Epic-style chart context across modules.
 */
import type { FacilityPatient } from './patientRegistryStore';
import { getPatient, listPatients } from './patientRegistryStore';

const KEY = 'medcore_os_patient_context_v1';
const EVT = 'medcore-patient-context';

export interface PatientContext {
  patientId: string;
  facilityId: string;
  hospitalNumber: string;
  displayName: string;
  setAt: string;
  setBy?: string;
}

function read(): PatientContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PatientContext) : null;
  } catch {
    return null;
  }
}

function write(ctx: PatientContext | null) {
  if (typeof window === 'undefined') return;
  if (!ctx) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, JSON.stringify(ctx));
  try {
    if (ctx) sessionStorage.setItem('medcore_focus_patient', ctx.patientId);
    else sessionStorage.removeItem('medcore_focus_patient');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVT, { detail: ctx }));
}

export function getPatientContext(): PatientContext | null {
  return read();
}

export function setPatientContext(
  patient: FacilityPatient | { id: string; facilityId: string; hospitalNumber: string; firstName: string; lastName: string },
  setBy?: string
): PatientContext {
  const ctx: PatientContext = {
    patientId: patient.id,
    facilityId: patient.facilityId,
    hospitalNumber: patient.hospitalNumber,
    displayName: `${patient.firstName} ${patient.lastName}`.trim(),
    setAt: new Date().toISOString(),
    setBy,
  };
  write(ctx);
  return ctx;
}

export function clearPatientContext() {
  write(null);
}

export function resolveContextPatient(): FacilityPatient | null {
  const ctx = read();
  if (!ctx) return null;
  return getPatient(ctx.patientId) || listPatients(ctx.facilityId).find((p) => p.id === ctx.patientId) || null;
}

export function subscribePatientContext(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('storage', fn);
  };
}
