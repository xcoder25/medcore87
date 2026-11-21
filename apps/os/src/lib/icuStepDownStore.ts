/**
 * ICU & High-Dependency Step-Down Clinical Telemetry Store
 * Persists ventilator settings, hemodynamics, smart infusion pumps, weaning readiness,
 * and atomic ICU -> Step-Down transfers backed by bedBoardStore.
 */
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
import { admitToBed, dischargeBed, listBeds, type BedRecord } from './bedBoardStore';
import { pushNotification } from './notificationEngine';

export type CriticalUnitTier = 'ICU' | 'HDU_STEPDOWN';
export type CriticalAcuity = 'critical' | 'guarded' | 'stable';
export type InfusionPumpStatus = 'running' | 'paused' | 'stopped';

export interface SmartInfusionPump {
  id: string;
  drug: string;
  dose: string;
  rateMlHr: string;
  status: InfusionPumpStatus;
  startedBy: string;
  updatedAt: string;
}

export interface WeaningReadiness {
  offVasopressors: boolean;
  spontaneousBreathing: boolean;
  spo2Stable: boolean;
  neuroStable: boolean;
}

export interface IcuBedTelemetryState {
  bedId: string;
  facilityId: string;
  unitTier: CriticalUnitTier;
  acuity: CriticalAcuity;
  ventilatorMode: string;
  fio2: number;
  peep: number;
  map: string;
  gcs: number;
  sofa: number;
  rass: string;
  infusions: SmartInfusionPump[];
  nurseAssigned: string;
  weaningChecklist: WeaningReadiness;
  updatedAt: string;
}

export const ICU_STEPDOWN_KEY = 'medcore_os_icu_stepdown_v1';
const EVT = 'medcore-icu-stepdown';

const DEFAULT_WEANING: WeaningReadiness = {
  offVasopressors: false,
  spontaneousBreathing: false,
  spo2Stable: false,
  neuroStable: false,
};

function readAll(): IcuBedTelemetryState[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ICU_STEPDOWN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(all: IcuBedTelemetryState[], facilityId?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ICU_STEPDOWN_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent(EVT, { detail: all }));
  const fid = facilityId || all[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(
      fid,
      FACILITY_KEYS.icuStepDown || ICU_STEPDOWN_KEY,
      all.filter((x) => x.facilityId === fid)
    );
  } catch {
    /* ignore */
  }
}

export function inferCriticalUnitTier(ward: string): CriticalUnitTier {
  const w = String(ward || '').toLowerCase();
  if (w.includes('hdu') || w.includes('step')) return 'HDU_STEPDOWN';
  return 'ICU';
}

export function isCriticalCareWard(ward: string): boolean {
  const w = String(ward || '').toLowerCase();
  return (
    w.includes('icu') ||
    w.includes('intensive') ||
    w.includes('hdu') ||
    w.includes('step') ||
    w.includes('critical') ||
    w.includes('pacu')
  );
}

export function getIcuBedState(
  facilityId: string,
  bedId: string,
  wardHint = ''
): IcuBedTelemetryState {
  const hit = readAll().find((x) => x.facilityId === facilityId && x.bedId === bedId);
  if (hit) return hit;
  const tier = inferCriticalUnitTier(wardHint);
  return {
    bedId,
    facilityId,
    unitTier: tier,
    acuity: tier === 'ICU' ? 'guarded' : 'stable',
    ventilatorMode: tier === 'ICU' ? 'PRVC / CPAP' : 'Room Air / Nasal O2',
    fio2: tier === 'ICU' ? 40 : 28,
    peep: tier === 'ICU' ? 5 : 0,
    map: '78 mmHg',
    gcs: 15,
    sofa: tier === 'ICU' ? 4 : 1,
    rass: '0 (Alert & Calm)',
    infusions: [],
    nurseAssigned: 'Unassigned',
    weaningChecklist: { ...DEFAULT_WEANING },
    updatedAt: new Date().toISOString(),
  };
}

export function listIcuBedStates(facilityId: string): IcuBedTelemetryState[] {
  return readAll().filter((x) => x.facilityId === facilityId);
}

export function upsertIcuBedState(
  facilityId: string,
  bedId: string,
  patch: Partial<Omit<IcuBedTelemetryState, 'bedId' | 'facilityId'>>
): IcuBedTelemetryState {
  const all = readAll();
  const idx = all.findIndex((x) => x.facilityId === facilityId && x.bedId === bedId);
  const base = idx >= 0 ? all[idx] : getIcuBedState(facilityId, bedId);
  const next: IcuBedTelemetryState = {
    ...base,
    ...patch,
    bedId,
    facilityId,
    weaningChecklist: {
      ...base.weaningChecklist,
      ...(patch.weaningChecklist || {}),
    },
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  saveAll(all, facilityId);
  return next;
}

export function addInfusionPump(
  facilityId: string,
  bedId: string,
  pump: Omit<SmartInfusionPump, 'id' | 'updatedAt'>
): IcuBedTelemetryState {
  const current = getIcuBedState(facilityId, bedId);
  const row: SmartInfusionPump = {
    ...pump,
    id: `PUMP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 4).toUpperCase()}`,
    updatedAt: new Date().toISOString(),
  };
  return upsertIcuBedState(facilityId, bedId, {
    infusions: [row, ...current.infusions],
  });
}

export function updateInfusionStatus(
  facilityId: string,
  bedId: string,
  pumpId: string,
  patch: Partial<Pick<SmartInfusionPump, 'status' | 'dose' | 'rateMlHr'>>
): IcuBedTelemetryState {
  const current = getIcuBedState(facilityId, bedId);
  const updatedPumps = current.infusions.map((p) =>
    p.id === pumpId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
  );
  return upsertIcuBedState(facilityId, bedId, { infusions: updatedPumps });
}

export function transferIcuToStepDown(
  facilityId: string,
  fromBedId: string,
  toBedId: string,
  actor: string
): { ok: boolean; error?: string; destinationBed?: BedRecord } {
  const beds = listBeds(facilityId);
  const source = beds.find((b) => b.id === fromBedId);
  const dest = beds.find((b) => b.id === toBedId);
  if (!source || !source.patient) {
    return { ok: false, error: 'Source critical care bed has no admitted patient.' };
  }
  if (!dest || dest.status !== 'available') {
    return { ok: false, error: 'Selected step-down destination bed is not available.' };
  }

  admitToBed(dest.id, {
    patient: source.patient,
    patientId: source.patientId,
    hospitalNumber: source.hospitalNumber,
    doctor: source.doctor,
    diagnosis: source.diagnosis,
    expectedDischarge: source.expectedDischarge,
    actor,
    isolation: source.status === 'isolation',
  });
  dischargeBed(source.id, actor);

  const srcState = getIcuBedState(facilityId, source.id, source.ward);
  upsertIcuBedState(facilityId, dest.id, {
    unitTier: inferCriticalUnitTier(dest.ward),
    acuity: 'stable',
    ventilatorMode: 'Room Air / O2 Weaned',
    fio2: 24,
    peep: 0,
    map: srcState.map,
    gcs: srcState.gcs,
    sofa: Math.max(0, srcState.sofa - 2),
    rass: srcState.rass,
    nurseAssigned: srcState.nurseAssigned,
    infusions: srcState.infusions.filter((p) => p.status !== 'stopped'),
    weaningChecklist: srcState.weaningChecklist,
  });

  try {
    pushNotification({
      facilityId,
      level: 'info',
      title: `ICU → Step-Down Transfer · ${source.patient}`,
      body: `Transferred from ${source.ward} (${source.bedNo}) to ${dest.ward} (${dest.bedNo}) by ${actor}`,
      module: 'nursing',
      roleHint: 'nurse',
      category: 'bed',
      patientId: source.patientId,
      patientName: source.patient,
      hospitalNumber: source.hospitalNumber,
      source: 'icu-stepdown',
    });
    pushNotification({
      facilityId,
      level: 'info',
      title: `ICU Step-Down Complete · ${source.patient}`,
      body: `${source.patient} (${source.hospitalNumber || 'Inpatient'}) moved from ${source.bedNo} to ${dest.ward} (${dest.bedNo})`,
      module: 'doctor-portal',
      roleHint: 'doctor',
      category: 'bed',
      patientId: source.patientId,
      patientName: source.patient,
      hospitalNumber: source.hospitalNumber,
      source: 'icu-stepdown',
    });
  } catch {
    /* ignore */
  }

  const updatedDest = listBeds(facilityId).find((b) => b.id === dest.id);
  return { ok: true, destinationBed: updatedDest };
}

export function applyRemoteIcuStepDown(facilityId: string, remote: unknown) {
  if (!Array.isArray(remote) || typeof window === 'undefined') return;
  const others = readAll().filter((x) => x.facilityId !== facilityId);
  const incoming = remote.filter(
    (x): x is IcuBedTelemetryState =>
      Boolean(x && typeof x === 'object' && (x as IcuBedTelemetryState).bedId)
  );
  localStorage.setItem(ICU_STEPDOWN_KEY, JSON.stringify([...incoming, ...others]));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function subscribeIcuStepDown(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener('storage', cb);
  };
}
