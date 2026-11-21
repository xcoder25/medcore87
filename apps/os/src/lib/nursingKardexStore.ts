/**
 * Realtime Nursing Kardex & e-MAR Store
 * Manages inpatient care tasks, medication administration records, and SBAR shift handovers.
 * Multi-facility safe: merges facility updates cleanly without overwriting other facilities.
 */
import { publishFacilityData } from './roleSyncBus';

export type KardexItemStatus = 'pending' | 'completed' | 'overdue' | 'held' | 'refused';

export interface NursingCareItem {
  id: string;
  facilityId: string;
  bedNumber: string;
  ward?: string;
  patientName: string;
  patientId?: string;
  hospitalNumber?: string;
  careActivity: string;
  dose?: string;
  route?: string;
  frequency: string;
  nextScheduledTime: string;
  status: KardexItemStatus;
  assignedNurse: string;
  administeredBy?: string;
  administeredAt?: string;
  notes?: string;
  orderId?: string;
  reason?: string;
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

export const KARDEX_KEY = 'medcore_os_nursing_kardex_v1';
export const SBAR_KEY = 'medcore_os_nursing_sbar_v1';
const EVT_KARDEX = 'medcore-nursing-kardex';
const EVT_SBAR = 'medcore-nursing-sbar';

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

function saveKardex(allItems: NursingCareItem[], facilityIdForSync?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KARDEX_KEY, JSON.stringify(allItems));
  window.dispatchEvent(new CustomEvent(EVT_KARDEX, { detail: allItems }));
  const fid = facilityIdForSync || allItems[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(fid, KARDEX_KEY, allItems.filter((x) => x.facilityId === fid));
  } catch {
    /* ignore */
  }
}

export function listNursingCareItems(facilityId: string): NursingCareItem[] {
  return readKardex().filter((item) => item.facilityId === facilityId);
}

/** Evaluates overdue status deterministically for pending e-MAR tasks past grace window. */
export function computeEffectiveKardexStatus(
  item: Pick<NursingCareItem, 'status' | 'nextScheduledTime'>,
  nowMs = Date.now()
): KardexItemStatus {
  if (item.status !== 'pending') return item.status;
  const raw = String(item.nextScheduledTime || '').trim();
  if (!raw) return 'pending';
  let dueMs = Date.parse(raw);
  if (Number.isNaN(dueMs)) {
    const hm = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) {
      const ref = new Date(nowMs);
      ref.setHours(parseInt(hm[1], 10), parseInt(hm[2], 10), 0, 0);
      dueMs = ref.getTime();
    }
  }
  if (!Number.isNaN(dueMs) && nowMs > dueMs + 15 * 60_000) {
    return 'overdue';
  }
  return 'pending';
}

export function addNursingCareItem(item: Omit<NursingCareItem, 'id'>): NursingCareItem {
  const all = readKardex();
  const newItem: NursingCareItem = {
    ...item,
    id: `NUR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
  };
  saveKardex([newItem, ...all], item.facilityId);
  return newItem;
}

export function updateCareItemStatus(
  id: string,
  facilityId: string,
  status: KardexItemStatus,
  actor: string,
  reason?: string
): boolean {
  const all = readKardex();
  const idx = all.findIndex((x) => x.id === id && x.facilityId === facilityId);
  if (idx < 0) return false;
  const existing = all[idx];
  const noteAppend = reason?.trim() ? `[${status.toUpperCase()}] ${reason.trim()}` : '';
  all[idx] = {
    ...existing,
    status,
    administeredBy: actor,
    administeredAt: new Date().toISOString(),
    reason: reason?.trim() || existing.reason,
    notes: noteAppend
      ? `${existing.notes ? `${existing.notes} | ` : ''}${noteAppend}`
      : existing.notes,
  };
  saveKardex(all, facilityId);
  return true;
}

export function signMedicationAdministration(
  id: string,
  facilityId: string,
  administeredBy: string,
  notes?: string
): boolean {
  return updateCareItemStatus(id, facilityId, 'completed', administeredBy, notes);
}

/** Syncs an acknowledged inpatient/e-MAR Rx order into the facility Kardex without duplicating by orderId. */
export function syncRxOrderToKardex(input: {
  facilityId: string;
  orderId: string;
  patientName: string;
  patientId?: string;
  hospitalNumber?: string;
  bedNumber: string;
  ward?: string;
  summary: string;
  dose?: string;
  route?: string;
  frequency?: string;
  assignedNurse: string;
}): NursingCareItem | null {
  const all = readKardex();
  const existing = all.find(
    (x) => x.facilityId === input.facilityId && x.orderId === input.orderId
  );
  if (existing) return existing;

  const hh = String(new Date().getHours()).padStart(2, '0');
  const mm = String(new Date().getMinutes()).padStart(2, '0');
  return addNursingCareItem({
    facilityId: input.facilityId,
    bedNumber: input.bedNumber || 'Ward Bed',
    ward: input.ward,
    patientName: input.patientName,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    careActivity: input.summary,
    dose: input.dose,
    route: input.route || 'As ordered',
    frequency: input.frequency || 'Per Rx schedule',
    nextScheduledTime: `${hh}:${mm}`,
    status: 'pending',
    assignedNurse: input.assignedNurse,
    orderId: input.orderId,
  });
}

export function applyRemoteKardex(facilityId: string, remote: unknown) {
  if (!Array.isArray(remote) || typeof window === 'undefined') return;
  const others = readKardex().filter((x) => x.facilityId !== facilityId);
  const incoming = remote.filter(
    (x): x is NursingCareItem => Boolean(x && typeof x === 'object' && (x as NursingCareItem).id)
  );
  localStorage.setItem(KARDEX_KEY, JSON.stringify([...incoming, ...others]));
  window.dispatchEvent(new CustomEvent(EVT_KARDEX));
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

function saveSbars(all: NursingSbarHandoff[], facilityIdForSync?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SBAR_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent(EVT_SBAR, { detail: all }));
  const fid = facilityIdForSync || all[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(fid, SBAR_KEY, all.filter((s) => s.facilityId === fid));
  } catch {
    /* ignore */
  }
}

export function listSbarHandoffs(facilityId: string): NursingSbarHandoff[] {
  return readSbars().filter((s) => s.facilityId === facilityId);
}

export function addSbarHandoff(
  handoff: Omit<NursingSbarHandoff, 'id' | 'recordedAt'>
): NursingSbarHandoff {
  const all = readSbars();
  const newRow: NursingSbarHandoff = {
    ...handoff,
    id: `SBAR-${Date.now().toString(36).toUpperCase()}`,
    recordedAt: new Date().toISOString(),
  };
  saveSbars([newRow, ...all], handoff.facilityId);
  return newRow;
}

export function applyRemoteSbar(facilityId: string, remote: unknown) {
  if (!Array.isArray(remote) || typeof window === 'undefined') return;
  const others = readSbars().filter((s) => s.facilityId !== facilityId);
  const incoming = remote.filter(
    (s): s is NursingSbarHandoff => Boolean(s && typeof s === 'object' && (s as NursingSbarHandoff).id)
  );
  localStorage.setItem(SBAR_KEY, JSON.stringify([...incoming, ...others]));
  window.dispatchEvent(new CustomEvent(EVT_SBAR));
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
