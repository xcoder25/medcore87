/**
 * Akwa Ibom statewide Unique Patient Identifier (UPI) linked to NIN.
 * Format: AKS-UPI-{LGA3}-{seq} with optional NIN binding.
 */
import { enqueueFacilitySync } from './durableOutbox';

export type AksFacilityTier = 'phc' | 'general' | 'specialist' | 'teaching' | 'private';

export interface StatewideFacility {
  id: string;
  name: string;
  lga: string;
  tier: AksFacilityTier;
}

export interface UpiRecord {
  upi: string;
  nin?: string;
  firstName: string;
  lastName: string;
  sex?: string;
  dob?: string;
  phone?: string;
  homeLga?: string;
  createdAtFacilityId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatewideReferral {
  id: string;
  upi: string;
  nin?: string;
  patientName: string;
  fromFacilityId: string;
  fromFacilityName: string;
  toFacilityId: string;
  toFacilityName: string;
  specialty: string;
  priority: 'routine' | 'urgent' | 'emergency';
  clinicalSummary: string;
  status: 'draft' | 'sent' | 'accepted' | 'arrived' | 'completed' | 'rejected';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export const AKS_FACILITIES: StatewideFacility[] = [
  { id: 'PHC-NSIT-ATAI', name: 'PHC Nsit Atai', lga: 'Nsit Atai', tier: 'phc' },
  { id: 'GH-ETINAN', name: 'General Hospital Etinan', lga: 'Etinan', tier: 'general' },
  { id: 'IGH-EKT', name: 'Immanuel General Hospital, Eket', lga: 'Eket', tier: 'general' },
  { id: 'GH-IKOT-EKPENE', name: 'General Hospital Ikot Ekpene', lga: 'Ikot Ekpene', tier: 'general' },
  { id: 'IBOM-SPEC', name: 'Ibom Specialist Hospital', lga: 'Uyo', tier: 'specialist' },
  { id: 'UUTH', name: 'University of Uyo Teaching Hospital', lga: 'Uyo', tier: 'teaching' },
  { id: 'PHC-ORON', name: 'PHC Oron', lga: 'Oron', tier: 'phc' },
  { id: 'GH-ORON', name: 'General Hospital Oron', lga: 'Oron', tier: 'general' },
];

const UPI_KEY = 'medcore_aks_upi_v1';
const REF_KEY = 'medcore_aks_referrals_v1';

function readUpi(): UpiRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(UPI_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeUpi(list: UpiRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(UPI_KEY, JSON.stringify(list.slice(0, 20000)));
  window.dispatchEvent(new CustomEvent('medcore-upi-sync'));
}
function readRef(): StatewideReferral[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(REF_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeRef(list: StatewideReferral[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REF_KEY, JSON.stringify(list.slice(0, 5000)));
  window.dispatchEvent(new CustomEvent('medcore-referral-sync'));
}

function lgaCode(lga?: string) {
  const s = (lga || 'AKS').replace(/[^A-Za-z]/g, '').toUpperCase();
  return (s.slice(0, 3) || 'AKS').padEnd(3, 'X');
}

export function ensureUpi(input: {
  facilityId: string;
  firstName: string;
  lastName: string;
  nin?: string;
  sex?: string;
  dob?: string;
  phone?: string;
  homeLga?: string;
}): UpiRecord {
  const nin = input.nin?.replace(/\D/g, '');
  const all = readUpi();
  if (nin && nin.length >= 11) {
    const hit = all.find((u) => u.nin === nin);
    if (hit) return hit;
  }
  const upi = `AKS-UPI-${lgaCode(input.homeLga)}-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();
  const row: UpiRecord = {
    upi,
    nin: nin || undefined,
    firstName: input.firstName,
    lastName: input.lastName,
    sex: input.sex,
    dob: input.dob,
    phone: input.phone,
    homeLga: input.homeLga,
    createdAtFacilityId: input.facilityId,
    createdAt: now,
    updatedAt: now,
  };
  writeUpi([row, ...all]);
  try {
    enqueueFacilitySync(input.facilityId, 'aks_upi', readUpi());
  } catch {
    /* optional */
  }
  return row;
}

export function findByNin(nin: string): UpiRecord | undefined {
  const d = nin.replace(/\D/g, '');
  return readUpi().find((u) => u.nin === d);
}

export function findByUpi(upi: string): UpiRecord | undefined {
  return readUpi().find((u) => u.upi === upi);
}

export function createStatewideReferral(input: Omit<StatewideReferral, 'id' | 'status' | 'createdAt' | 'updatedAt'> & { status?: StatewideReferral['status'] }): StatewideReferral {
  const now = new Date().toISOString();
  const row: StatewideReferral = {
    ...input,
    id: `SREF-${Date.now().toString(36).toUpperCase()}`,
    status: input.status || 'sent',
    createdAt: now,
    updatedAt: now,
  };
  writeRef([row, ...readRef()]);
  try {
    enqueueFacilitySync(input.fromFacilityId, 'aks_referrals', readRef());
  } catch {
    /* ignore */
  }
  return row;
}

export function listStatewideReferrals(facilityId?: string): StatewideReferral[] {
  const all = readRef();
  if (!facilityId) return all;
  return all.filter((r) => r.fromFacilityId === facilityId || r.toFacilityId === facilityId);
}

export function updateReferralStatus(id: string, status: StatewideReferral['status']) {
  const all = readRef();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i], status, updatedAt: new Date().toISOString() };
  writeRef(all);
  return all[i];
}

export function listAksFacilities() {
  return AKS_FACILITIES;
}
