/**
 * Ward Medication Requests Store
 * Connects Inpatient Nurses / Midwives directly with Pharmacy Dispensing Desk
 * for patient-linked doses, ward stock replenishment, and STAT emergency drugs.
 */
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
import { pushNotification } from './notificationEngine';

export type WardMedRequestType = 'patient_dose' | 'ward_stock' | 'stat_emergency';
export type WardMedRequestPriority = 'routine' | 'urgent' | 'stat';
export type WardMedRequestStatus = 'pending' | 'approved' | 'dispensed' | 'rejected';

export interface WardMedRequest {
  id: string;
  facilityId: string;
  ward: string;
  bedNumber: string;
  patientId?: string;
  patientName?: string;
  hospitalNumber?: string;
  requestType: WardMedRequestType;
  drugName: string;
  dosage: string;
  quantity: number;
  priority: WardMedRequestPriority;
  status: WardMedRequestStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  pharmacyNotes?: string;
}

export const WARD_MED_REQUESTS_KEY = 'medcore_os_ward_med_requests_v1';
const EVT = 'medcore-ward-med-requests';
const BC_NAME = 'medcore_ward_med_requests_bc';

function readAll(): WardMedRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(WARD_MED_REQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(all: WardMedRequest[], facilityId?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(WARD_MED_REQUESTS_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent(EVT, { detail: all }));
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({ type: 'updated', facilityId });
    bc.close();
  } catch {
    /* ignore */
  }
  const fid = facilityId || all[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(
      fid,
      FACILITY_KEYS.wardMedRequests || WARD_MED_REQUESTS_KEY,
      all.filter((r) => r.facilityId === fid)
    );
  } catch {
    /* ignore */
  }
}

export function listWardMedRequests(facilityId: string): WardMedRequest[] {
  return readAll()
    .filter((r) => r.facilityId === facilityId)
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt));
}

export function createWardMedRequest(
  input: Omit<WardMedRequest, 'id' | 'status' | 'requestedAt'>
): WardMedRequest {
  const all = readAll();
  const row: WardMedRequest = {
    ...input,
    id: `WMR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  saveAll([row, ...all], input.facilityId);

  try {
    pushNotification({
      facilityId: input.facilityId,
      level: input.priority === 'stat' ? 'critical' : input.priority === 'urgent' ? 'important' : 'info',
      title: `${input.priority === 'stat' ? 'STAT ' : ''}Ward Med Request · ${input.ward}`,
      body: `${input.drugName} (${input.dosage}, qty ${input.quantity})${input.patientName ? ` for ${input.patientName}` : ' (Ward Stock)'} — requested by ${input.requestedBy}`,
      module: 'pharmacy',
      roleHint: 'pharmacist',
      category: 'pharmacy',
      patientId: input.patientId,
      patientName: input.patientName,
      hospitalNumber: input.hospitalNumber,
      source: 'ward-med-request',
    });
  } catch {
    /* ignore */
  }

  return row;
}

export function updateWardMedRequestStatus(
  id: string,
  facilityId: string,
  status: WardMedRequestStatus,
  reviewedBy: string,
  pharmacyNotes?: string
): WardMedRequest | null {
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id && r.facilityId === facilityId);
  if (idx < 0) return null;
  const updated: WardMedRequest = {
    ...all[idx],
    status,
    reviewedBy,
    reviewedAt: new Date().toISOString(),
    pharmacyNotes: pharmacyNotes?.trim() || all[idx].pharmacyNotes,
  };
  all[idx] = updated;
  saveAll(all, facilityId);

  if (status === 'dispensed' || status === 'rejected' || status === 'approved') {
    try {
      pushNotification({
        facilityId,
        level: status === 'rejected' ? 'important' : 'info',
        title: `Ward Med Request ${status.toUpperCase()} · ${updated.ward}`,
        body: `${updated.drugName} (${updated.dosage}, qty ${updated.quantity}) marked ${status} by Pharmacy (${reviewedBy})${updated.pharmacyNotes ? ` — ${updated.pharmacyNotes}` : ''}`,
        module: 'nursing',
        roleHint: 'nurse',
        category: 'clinical',
        patientId: updated.patientId,
        patientName: updated.patientName,
        hospitalNumber: updated.hospitalNumber,
        source: 'ward-med-request',
      });
    } catch {
      /* ignore */
    }
  }

  return updated;
}

export function applyRemoteWardMedRequests(facilityId: string, remote: unknown) {
  if (!Array.isArray(remote) || typeof window === 'undefined') return;
  const others = readAll().filter((r) => r.facilityId !== facilityId);
  const incoming = remote.filter(
    (r): r is WardMedRequest => Boolean(r && typeof r === 'object' && (r as WardMedRequest).id)
  );
  localStorage.setItem(WARD_MED_REQUESTS_KEY, JSON.stringify([...incoming, ...others]));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function subscribeWardMedRequests(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVT, cb);
  window.addEventListener('storage', cb);
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = () => cb();
  } catch {
    /* ignore */
  }
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener('storage', cb);
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
  };
}
