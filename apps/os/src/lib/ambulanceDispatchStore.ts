import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
/**
 * Ambulance dispatch — local-first realtime for hospital admin.
 */
export type UnitStatus = 'available' | 'en_route' | 'at_scene' | 'returning' | 'offline';

export interface AmbulanceUnit {
  id: string;
  facilityId: string;
  callSign: string;
  plate: string;
  status: UnitStatus;
  crew: string;
  location: string;
  patient?: string;
  notes?: string;
  updatedAt: string;
}

const KEY = 'medcore_os_ambulance_v1';
const EVT = 'medcore-ambulance';

function load(): AmbulanceUnit[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : Array.isArray(p.units) ? p.units : [];
  } catch {
    return [];
  }
}

function save(units: AmbulanceUnit[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(units));
  window.dispatchEvent(new CustomEvent(EVT, { detail: units }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  const fid = units[0]?.facilityId || 'IGH-EKT';
  publishFacilityData(fid, FACILITY_KEYS.ambulance, units);
}

export function listUnits(facilityId: string): AmbulanceUnit[] {
  return load().filter((u) => u.facilityId === facilityId);
}

export function ensureDefaultFleet(facilityId: string): AmbulanceUnit[] {
  const all = load();
  const mine = all.filter((u) => u.facilityId === facilityId);
  if (mine.length > 0) return mine;
  const now = new Date().toISOString();
  const defaults: AmbulanceUnit[] = [
    {
      id: `${facilityId}-AMB-1`,
      facilityId,
      callSign: 'AMB-01',
      plate: 'AKS-AMB-001',
      status: 'available',
      crew: 'Unassigned',
      location: 'Station bay',
      updatedAt: now,
    },
    {
      id: `${facilityId}-AMB-2`,
      facilityId,
      callSign: 'AMB-02',
      plate: 'AKS-AMB-002',
      status: 'available',
      crew: 'Unassigned',
      location: 'Station bay',
      updatedAt: now,
    },
    {
      id: `${facilityId}-AMB-3`,
      facilityId,
      callSign: 'AMB-03',
      plate: 'AKS-AMB-003',
      status: 'offline',
      crew: '—',
      location: 'Workshop',
      updatedAt: now,
    },
  ];
  save([...defaults, ...all.filter((u) => u.facilityId !== facilityId)]);
  return defaults;
}

export function updateUnit(id: string, patch: Partial<AmbulanceUnit>) {
  const all = load();
  const next = all.map((u) =>
    u.id === id ? { ...u, ...patch, updatedAt: new Date().toISOString() } : u
  );
  save(next);
}

export function dispatchUnit(
  id: string,
  input: { patient?: string; location: string; notes?: string; crew?: string }
) {
  updateUnit(id, {
    status: 'en_route',
    patient: input.patient,
    location: input.location,
    notes: input.notes,
    crew: input.crew,
  });
}

export function subscribeAmbulance(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('medcore-data-reset', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('medcore-data-reset', fn);
  };
}
