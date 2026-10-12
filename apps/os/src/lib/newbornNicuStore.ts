/**
 * Newborn / NICU store — Epic Stork newborn / Cerner PowerChart neonatal parity.
 * Local-first + facility cloud sync; no demo patients.
 */
import { publishFacilityData } from './roleSyncBus';
import { pushNotification } from './notificationEngine';

export type NicuLevel = 'well' | 'level1' | 'level2' | 'level3';
export type FeedingMode = 'breast' | 'cup' | 'ng' | 'iv' | 'mixed';
export type NewbornStatus = 'active' | 'discharged' | 'referred' | 'deceased';

export interface NewbornRecord {
  id: string;
  facilityId: string;
  motherName: string;
  motherId?: string;
  maternityId?: string;
  babyName: string;
  sex: 'M' | 'F' | 'U';
  dob: string;
  timeOfBirth?: string;
  gestationalWeeks: number;
  birthWeightG: number;
  currentWeightG?: number;
  apgar1?: number;
  apgar5?: number;
  apgar10?: number;
  incubatorId?: string;
  bedLabel?: string;
  nicuLevel: NicuLevel;
  feeding: FeedingMode;
  phototherapy: boolean;
  oxygenLpm: number;
  tempC?: number;
  spo2?: number;
  hr?: number;
  bilirubin?: number;
  vitaminK: boolean;
  hepB: boolean;
  bcg?: boolean;
  cordCare?: string;
  diagnosis?: string;
  notes?: string;
  status: NewbornStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IncubatorBay {
  id: string;
  facilityId: string;
  label: string;
  occupiedBy?: string;
  targetTempC: number;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
}

const KEY = 'medcore_os_newborn_nicu_v1';
const BAY_KEY = 'medcore_os_nicu_bays_v1';
const EVT = 'medcore-newborn-nicu';

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}
function write(key: string, list: unknown[], facilityId?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(list.slice(0, 2000)));
  window.dispatchEvent(new CustomEvent(EVT));
  try {
    const fid =
      facilityId ||
      (list[0] as { facilityId?: string } | undefined)?.facilityId ||
      'IGH-EKT';
    publishFacilityData(String(fid), key, list);
  } catch {
    /* offline */
  }
}

export function newNewbornId() {
  return `NB-${Date.now().toString(36).toUpperCase()}`;
}

export function listNewborns(facilityId: string, status?: NewbornStatus): NewbornRecord[] {
  let rows = read<NewbornRecord>(KEY).filter((r) => r.facilityId === facilityId);
  if (status) rows = rows.filter((r) => r.status === status);
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertNewborn(row: NewbornRecord) {
  const all = read<NewbornRecord>(KEY);
  const i = all.findIndex((x) => x.id === row.id);
  const next = { ...row, updatedAt: new Date().toISOString() };
  if (i >= 0) all[i] = next;
  else all.unshift(next);
  write(KEY, all, row.facilityId);
  return next;
}

export function admitNewborn(
  input: Omit<NewbornRecord, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: NewbornStatus }
): NewbornRecord {
  const now = new Date().toISOString();
  const row: NewbornRecord = {
    ...input,
    id: newNewbornId(),
    status: input.status || 'active',
    createdAt: now,
    updatedAt: now,
    vitaminK: input.vitaminK ?? false,
    hepB: input.hepB ?? false,
    phototherapy: input.phototherapy ?? false,
    oxygenLpm: input.oxygenLpm ?? 0,
    feeding: input.feeding || 'breast',
    nicuLevel: input.nicuLevel || 'well',
  };
  upsertNewborn(row);
  if (row.birthWeightG < 1500 || row.gestationalWeeks < 32) {
    pushNotification({
      facilityId: row.facilityId,
      level: 'important',
      title: 'NICU admission',
      body: `${row.babyName || 'Newborn'} · ${row.gestationalWeeks}w · ${row.birthWeightG}g`,
      module: 'paediatrics',
      roleHint: 'midwife',
    });
  }
  return row;
}

export function listBays(facilityId: string): IncubatorBay[] {
  let bays = read<IncubatorBay>(BAY_KEY).filter((b) => b.facilityId === facilityId);
  if (!bays.length) {
    bays = Array.from({ length: 8 }, (_, i) => ({
      id: `BAY-${facilityId}-${i + 1}`,
      facilityId,
      label: `NICU-${String(i + 1).padStart(2, '0')}`,
      targetTempC: 36.5,
      status: 'available' as const,
    }));
    write(BAY_KEY, bays, facilityId);
  }
  return bays;
}

export function assignBay(facilityId: string, bayId: string, newbornId: string | undefined) {
  const bays = listBays(facilityId).map((b) => {
    if (b.id === bayId) {
      return {
        ...b,
        occupiedBy: newbornId,
        status: (newbornId ? 'occupied' : 'available') as IncubatorBay['status'],
      };
    }
    if (newbornId && b.occupiedBy === newbornId) {
      return { ...b, occupiedBy: undefined, status: 'available' as const };
    }
    return b;
  });
  write(BAY_KEY, bays, facilityId);
  if (newbornId) {
    const nb = listNewborns(facilityId).find((n) => n.id === newbornId);
    if (nb) {
      const bay = bays.find((b) => b.id === bayId);
      upsertNewborn({ ...nb, incubatorId: bayId, bedLabel: bay?.label });
    }
  }
}

export function newbornKpis(facilityId: string) {
  const active = listNewborns(facilityId, 'active');
  const bays = listBays(facilityId);
  const occupied = bays.filter((b) => b.status === 'occupied').length;
  return {
    active: active.length,
    phototherapy: active.filter((n) => n.phototherapy).length,
    elbw: active.filter((n) => n.birthWeightG < 1000).length,
    preterm: active.filter((n) => n.gestationalWeeks < 37).length,
    baysOccupied: occupied,
    baysTotal: bays.length,
    onOxygen: active.filter((n) => n.oxygenLpm > 0).length,
  };
}

export function subscribeNewborn(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('medcore-admin-sync', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('medcore-admin-sync', fn);
  };
}

/** Weight-based dose helpers (clinical reference — verify locally) */
export function paediatricDose(drug: string, weightKg: number): string {
  const w = Math.max(0.5, weightKg);
  switch (drug) {
    case 'paracetamol':
      return `${Math.round(w * 15)} mg (15 mg/kg QDS PRN · max 60 mg/kg/day)`;
    case 'amoxicillin':
      return `${Math.round(w * 25)} mg (25–30 mg/kg TDS)`;
    case 'gentamicin':
      return `${(w * 5).toFixed(1)} mg (5 mg/kg once daily · check levels)`;
    case 'caffeine':
      return `Load ${(w * 20).toFixed(1)} mg · maint ${(w * 5).toFixed(1)} mg/day`;
    default:
      return 'Select drug';
  }
}
