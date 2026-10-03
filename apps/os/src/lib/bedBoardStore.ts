import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
/**
 * Hospital bed board — local-first, facility-scoped, realtime via events.
 */
export type BedStatus = 'occupied' | 'available' | 'maintenance' | 'isolation';

export interface BedRecord {
  id: string;
  facilityId: string;
  ward: string;
  bedNo: string;
  status: BedStatus;
  patient?: string;
  patientId?: string;
  admitDate?: string;
  doctor?: string;
  diagnosis?: string;
  updatedAt: string;
}

const KEY = 'medcore_os_bed_board_v1';
const EVT = 'medcore-bed-board';

type State = { beds: BedRecord[] };

function load(): State {
  if (typeof window === 'undefined') return { beds: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { beds: [] };
    const p = JSON.parse(raw);
    return { beds: Array.isArray(p.beds) ? p.beds : [] };
  } catch {
    return { beds: [] };
  }
}

function save(state: State) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVT, { detail: state }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  const fid = state.beds[0]?.facilityId || 'IGH-EKT';
  publishFacilityData(fid, FACILITY_KEYS.beds, state);
}

export function listBeds(facilityId: string): BedRecord[] {
  return load().beds.filter((b) => b.facilityId === facilityId);
}

/** Ensure empty available beds exist for pilot wards (idempotent). */
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
  return beds;
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
  input: { patient: string; patientId?: string; doctor?: string; diagnosis?: string }
) {
  const state = load();
  state.beds = state.beds.map((b) =>
    b.id === bedId
      ? {
          ...b,
          status: 'occupied' as const,
          patient: input.patient,
          patientId: input.patientId,
          doctor: input.doctor,
          diagnosis: input.diagnosis || 'Admitted',
          admitDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          updatedAt: new Date().toISOString(),
        }
      : b
  );
  save(state);
}

export function dischargeBed(bedId: string) {
  const state = load();
  state.beds = state.beds.map((b) =>
    b.id === bedId
      ? {
          ...b,
          status: 'available' as const,
          patient: undefined,
          patientId: undefined,
          doctor: undefined,
          diagnosis: undefined,
          admitDate: undefined,
          updatedAt: new Date().toISOString(),
        }
      : b
  );
  save(state);
}

export function setBedStatus(bedId: string, status: BedStatus) {
  const state = load();
  state.beds = state.beds.map((b) =>
    b.id === bedId ? { ...b, status, updatedAt: new Date().toISOString() } : b
  );
  save(state);
}

export function transferBedWard(bedId: string, ward: string) {
  const state = load();
  state.beds = state.beds.map((b) =>
    b.id === bedId ? { ...b, ward: ward.trim(), updatedAt: new Date().toISOString() } : b
  );
  save(state);
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
  window.dispatchEvent(new CustomEvent(EVT, { detail: { beds: [] } }));
}
