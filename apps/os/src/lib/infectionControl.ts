/** Infection control — isolation, cases, stewardship flags */
import { publishFacilityData } from './roleSyncBus';

export type IsolationType = 'standard' | 'contact' | 'droplet' | 'airborne' | 'protective';

export interface InfectionCase {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  organism?: string;
  syndrome: string;
  isolation: IsolationType;
  status: 'active' | 'cleared';
  notedAt: string;
  notedBy: string;
  antibiotics?: string;
}

const KEY = 'medcore_os_infection_v1';
const EVT = 'medcore-infection';

function read(): InfectionCase[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
function write(list: InfectionCase[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 2000)));
  window.dispatchEvent(new CustomEvent(EVT));
  publishFacilityData(list[0]?.facilityId || 'IGH-EKT', KEY, list);
}

export function listInfectionCases(facilityId: string): InfectionCase[] {
  return read().filter((c) => c.facilityId === facilityId);
}

export function addInfectionCase(input: Omit<InfectionCase, 'id' | 'notedAt' | 'status'>): InfectionCase {
  const row: InfectionCase = {
    ...input,
    id: `INF-${Date.now().toString(36)}`,
    status: 'active',
    notedAt: new Date().toISOString(),
  };
  write([row, ...read()]);
  return row;
}

export function clearInfectionCase(id: string) {
  write(read().map((c) => (c.id === id ? { ...c, status: 'cleared' as const } : c)));
}

export function activeIsolations(facilityId: string) {
  return listInfectionCases(facilityId).filter((c) => c.status === 'active');
}

export function subscribeInfection(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}

export const INFECTION_KEY = KEY;
