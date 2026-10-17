/**
 * Realtime Nursing Kardex & e-MAR Store
 * Manages inpatient care tasks, medication administration records, and SBAR shift handovers.
 */
import { publishFacilityData } from './roleSyncBus';

export interface NursingCareItem {
  id: string;
  facilityId: string;
  bedNumber: string;
  ward?: string;
  patientName: string;
  hospitalNumber?: string;
  careActivity: string;
  dose?: string;
  route?: string;
  frequency: string;
  nextScheduledTime: string;
  status: 'pending' | 'completed' | 'overdue';
  assignedNurse: string;
  administeredBy?: string;
  administeredAt?: string;
  notes?: string;
}

export interface NursingSbarHandoff {
  id: string;
  facilityId: string;
  ward: string;
  outgoingNurse: string;
  incomingNurse: string;
  shift: 'Morning (08:00–16:00)' | 'Evening (16:00–22:00)' | 'Night (22:00–08:00)';
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  recordedAt: string;
}

const KARDEX_KEY = 'medcore_os_nursing_kardex_v1';
const SBAR_KEY = 'medcore_os_nursing_sbar_v1';
const EVT_KARDEX = 'medcore-nursing-kardex';
const EVT_SBAR = 'medcore-nursing-sbar';

const SEED_CARE_ITEMS: Omit<NursingCareItem, 'id' | 'facilityId'>[] = [
  {
    bedNumber: 'Bed 04',
    ward: 'Male Medical',
    patientName: 'Emmanuel Udoh',
    hospitalNumber: 'GH-2026-0812',
    careActivity: 'IV Ceftriaxone 1g in 100ml NS',
    dose: '1g IV',
    route: 'IV Infusion',
    frequency: 'Q12H',
    nextScheduledTime: '12:00',
    status: 'pending',
    assignedNurse: 'Nurse Blessing (SN)',
    notes: 'Severe pneumonia, check IV cannula site before push',
  },
  {
    bedNumber: 'Bed 08',
    ward: 'Male Medical',
    patientName: 'Samuel Archibong',
    hospitalNumber: 'GH-2026-0419',
    careActivity: 'Tab Artemether/Lumefantrine (Coartem) 80/480mg',
    dose: '1 tab PO',
    route: 'Oral with food',
    frequency: 'BID',
    nextScheduledTime: '14:00',
    status: 'pending',
    assignedNurse: 'Nurse Blessing (SN)',
    notes: 'Ensure meal is consumed before administration',
  },
  {
    bedNumber: 'Bed 12',
    ward: 'Female Medical',
    patientName: 'Patience Okon',
    hospitalNumber: 'GH-2026-0922',
    careActivity: 'Regular Insulin 8 IU SubQ',
    dose: '8 IU SubQ',
    route: 'Subcutaneous',
    frequency: 'TID AC',
    nextScheduledTime: '13:00',
    status: 'overdue',
    assignedNurse: 'Nurse Deborah (NO II)',
    notes: 'Check blood glucose before administration',
  },
  {
    bedNumber: 'Bed 03',
    ward: 'Surgical Ward',
    patientName: 'Bassey Bassey',
    hospitalNumber: 'GH-2026-0311',
    careActivity: 'Wound Dressing & Drain Inspection',
    dose: 'Sterile dressing',
    route: 'Topical / Surgical Site',
    frequency: 'Daily',
    nextScheduledTime: '11:00',
    status: 'pending',
    assignedNurse: 'Nurse Deborah (NO II)',
    notes: 'Post-laparotomy Day 2, record drain output in chart',
  },
  {
    bedNumber: 'Bed 02',
    ward: 'ICU',
    patientName: 'Idongesit Akpan',
    hospitalNumber: 'GH-2026-0105',
    careActivity: 'IV Paracetamol 1g Infusion',
    dose: '1g IV in 100ml',
    route: 'IV Infusion',
    frequency: 'Q6H PRN',
    nextScheduledTime: '09:00',
    status: 'completed',
    assignedNurse: 'Nurse Ekaette (CNO)',
    administeredBy: 'Nurse Ekaette (CNO)',
    administeredAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    notes: 'Temp was 38.6°C, settled to 37.1°C post infusion',
  },
];

function readKardex(): NursingCareItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KARDEX_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveKardex(list: NursingCareItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KARDEX_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVT_KARDEX, { detail: list }));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(fid, KARDEX_KEY, list);
  } catch { /* ignore */ }
}

export function listNursingCareItems(facilityId: string): NursingCareItem[] {
  let list = readKardex().filter((item) => item.facilityId === facilityId);
  if (list.length === 0) {
    // Seed initial realistic tasks for this facility
    list = SEED_CARE_ITEMS.map((item, idx) => ({
      ...item,
      id: `NUR-${(idx + 1).toString().padStart(4, '0')}`,
      facilityId,
    }));
    saveKardex(list);
  }
  return list;
}

export function addNursingCareItem(item: Omit<NursingCareItem, 'id'>): NursingCareItem {
  const current = listNursingCareItems(item.facilityId);
  const newItem: NursingCareItem = {
    ...item,
    id: `NUR-${Date.now().toString(36).toUpperCase()}`,
  };
  const updated = [newItem, ...current];
  saveKardex(updated);
  return newItem;
}

export function signMedicationAdministration(
  id: string,
  facilityId: string,
  administeredBy: string,
  notes?: string
): boolean {
  const list = listNursingCareItems(facilityId);
  const idx = list.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  list[idx] = {
    ...list[idx],
    status: 'completed',
    administeredBy,
    administeredAt: new Date().toISOString(),
    notes: notes ? `${list[idx].notes ? `${list[idx].notes} | ` : ''}${notes}` : list[idx].notes,
  };
  saveKardex(list);
  return true;
}

export function subscribeNursingKardex(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVT_KARDEX, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVT_KARDEX, cb);
    window.removeEventListener('storage', cb);
  };
}

// ─── SBAR HANDOFF ─────────────────────────────────────────────────────────────

function readSbars(): NursingSbarHandoff[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SBAR_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveSbars(list: NursingSbarHandoff[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SBAR_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVT_SBAR, { detail: list }));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(fid, SBAR_KEY, list);
  } catch { /* ignore */ }
}

export function listSbarHandoffs(facilityId: string): NursingSbarHandoff[] {
  return readSbars().filter((s) => s.facilityId === facilityId);
}

export function addSbarHandoff(handoff: Omit<NursingSbarHandoff, 'id' | 'recordedAt'>): NursingSbarHandoff {
  const current = listSbarHandoffs(handoff.facilityId);
  const newRow: NursingSbarHandoff = {
    ...handoff,
    id: `SBAR-${Date.now().toString(36).toUpperCase()}`,
    recordedAt: new Date().toISOString(),
  };
  saveSbars([newRow, ...current]);
  return newRow;
}

export function subscribeSbar(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVT_SBAR, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVT_SBAR, cb);
    window.removeEventListener('storage', cb);
  };
}
