import { billPharmacyRx, billLabOrder, billImagingOrder, isOrderBillCleared } from './patientBillingStore';
import { sendPaymentRequestToAccounts } from './frontDeskAccountsBridge';
import { enqueue } from './universalQueue';
import { pushNotification } from './notificationEngine';
import { checkPrescriptionSafety } from './pharmacySafety';
import { getPatient } from './patientRegistryStore';
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';
import { evaluateOrderBpa, evaluateResultForCritical } from './clinicalIntelligenceEngine';
/**
 * Closed clinical loop bus: Order → Lab/Rx → Result → Doctor screen
 * Local-first + broadcast; optional Firestore facility mirror.
 */
export type ClinicalOrderType = 'lab' | 'rx' | 'imaging' | 'procedure';
export type ClinicalOrderStatus =
  | 'ordered'
  | 'accepted'
  | 'in_progress'
  | 'resulted'
  | 'cancelled';

export interface ClinicalOrder {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  type: ClinicalOrderType;
  code: string;
  name: string;
  orderedBy: string;
  orderedByBadge?: string;
  status: ClinicalOrderStatus;
  priority: 'routine' | 'urgent' | 'stat';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  resultSummary?: string;
  resultAt?: string;
  resultedBy?: string;
}

const KEY = 'medcore_os_clinical_orders_v1';

function read(): ClinicalOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: ClinicalOrder[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8000)));
  window.dispatchEvent(new CustomEvent('medcore-clinical-orders', { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  publishFacilityData(fid, FACILITY_KEYS.clinical, list);
  try {
    const bc = new BroadcastChannel('medcore_clinical');
    bc.postMessage({ type: 'orders', list });
    bc.close();
  } catch {
    /* ignore */
  }
}

export function listOrders(facilityId: string, opts?: { patientId?: string; status?: ClinicalOrderStatus }) {
  let list = read().filter((o) => o.facilityId === facilityId);
  if (opts?.patientId) list = list.filter((o) => o.patientId === opts.patientId);
  if (opts?.status) list = list.filter((o) => o.status === opts.status);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function placeOrder(input: Omit<ClinicalOrder, 'id' | 'status' | 'createdAt' | 'updatedAt'>): ClinicalOrder {
  const order: ClinicalOrder = {
    ...input,
    id: `ORD-${Date.now().toString(36).toUpperCase()}`,
    status: 'ordered',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  write([order, ...read()]);
  if (order.type === 'rx') {
    try {
      billPharmacyRx({
        facilityId: order.facilityId,
        patientId: order.patientId,
        hospitalNumber: order.hospitalNumber,
        patientName: order.patientName,
        orderId: order.id,
        drugName: order.name,
      });
    } catch { /* ignore */ }
  }
  if (order.type === 'lab') {
    try {
      billLabOrder({
        facilityId: order.facilityId,
        patientId: order.patientId,
        hospitalNumber: order.hospitalNumber,
        patientName: order.patientName,
        orderId: order.id,
        testName: order.name,
      });
    } catch { /* ignore */ }
  }
  if (order.type === 'imaging') {
    try {
      billImagingOrder({
        facilityId: order.facilityId,
        patientId: order.patientId,
        hospitalNumber: order.hospitalNumber,
        patientName: order.patientName,
        orderId: order.id,
        studyName: order.name,
      });
    } catch { /* ignore */ }
  }
  // Financial handoff → Accounts (same pipeline as Front Desk folder fee)
  if (order.type === 'lab' || order.type === 'rx' || order.type === 'imaging') {
    try {
      const fee =
        order.type === 'lab' ? 3500 : order.type === 'rx' ? 2500 : 8000;
      sendPaymentRequestToAccounts({
        facilityId: order.facilityId,
        facilityName: order.facilityId,
        patientId: order.patientId,
        hospitalNumber: order.hospitalNumber,
        patientName: order.patientName,
        amountNgn: fee,
        purpose: `${order.type.toUpperCase()} · ${order.name}`,
        source: 'billing_office',
        sentBy: order.orderedBy || 'Clinical',
        sentByBadge: order.orderedByBadge,
        note: `Order ${order.id} — pay at Accounts before result/dispense release`,
      });
      pushNotification({
        facilityId: order.facilityId,
        level: 'important',
        title: `New ${order.type} charge — Accounts`,
        body: `${order.patientName} · ${order.name} · pay before release`,
        module: 'cashier',
        roleHint: 'accountant',
      });
    } catch { /* ignore */ }
  }
  try {
    const dept =
      order.type === 'lab' ? 'lab' : order.type === 'rx' ? 'pharmacy' : order.type === 'imaging' ? 'radiology' : 'opd';
    enqueue({
      facilityId: order.facilityId,
      department: dept as any,
      patientId: order.patientId,
      hospitalNumber: order.hospitalNumber,
      patientName: order.patientName,
      priority: order.priority === 'stat' ? 'stat' : order.priority === 'urgent' ? 'urgent' : 'routine',
      service: order.name,
      linkedOrderId: order.id,
    });
    if (order.priority === 'stat') {
      pushNotification({
        facilityId: order.facilityId,
        level: 'critical',
        title: `STAT ${order.type.toUpperCase()}`,
        body: `${order.patientName}: ${order.name}`,
        module: order.type === 'lab' ? 'laboratory' : order.type === 'rx' ? 'pharmacy' : 'radiology',
        patientId: order.patientId,
      });
    }
    if (order.type === 'rx') {
      const pat = getPatient(order.patientId);
      const flags = checkPrescriptionSafety({
        drugName: order.name,
        allergies: pat?.allergies,
        otherDrugs: pat?.currentMedications,
        notes: order.notes,
      });
      for (const f of flags.filter((x) => x.level === 'high')) {
        pushNotification({
          facilityId: order.facilityId,
          level: 'critical',
          title: 'Pharmacy safety',
          body: f.message,
          module: 'pharmacy',
          patientId: order.patientId,
        });
      }
    }
    // Epic/Cerner-style BPA on place
    try {
      const bpas = evaluateOrderBpa({
        facilityId: order.facilityId,
        patientId: order.patientId,
        type: order.type,
        code: order.code,
        name: order.name,
        priority: order.priority,
      });
      for (const b of bpas.filter((x) => x.level === 'hard_stop' || x.level === 'warning')) {
        pushNotification({
          facilityId: order.facilityId,
          level: b.level === 'hard_stop' ? 'critical' : 'important',
          title: b.title,
          body: b.detail,
          module: 'doctor-portal',
          patientId: order.patientId,
        });
      }
    } catch { /* assistive */ }
  } catch { /* ignore */ }
  return order;
}

export function updateOrderStatus(
  id: string,
  status: ClinicalOrderStatus,
  extra?: Partial<Pick<ClinicalOrder, 'resultSummary' | 'resultedBy'>>
): ClinicalOrder | undefined {
  const list = read();
  const idx = list.findIndex((o) => o.id === id);
  if (idx < 0) return undefined;
  const next = {
    ...list[idx],
    status,
    updatedAt: new Date().toISOString(),
    ...(status === 'resulted'
      ? {
          resultAt: new Date().toISOString(),
          resultSummary: extra?.resultSummary || list[idx].resultSummary,
          resultedBy: extra?.resultedBy,
        }
      : {}),
    ...extra,
  };
  list[idx] = next;
  write(list);
  return next;
}

export function postLabResult(
  orderId: string,
  summary: string,
  by: string
): ClinicalOrder | undefined {
  const pay = isOrderBillCleared(orderId);
  if (!pay.cleared) {
    throw new Error(
      `Payment required · ₦${pay.amountNgn.toLocaleString()} — patient must pay at Accounts before result release`
    );
  }
  const order = updateOrderStatus(orderId, 'resulted', { resultSummary: summary, resultedBy: by });
  if (order) {
    try {
      evaluateResultForCritical(order);
    } catch { /* assistive only */ }
    try {
      pushNotification({
        facilityId: order.facilityId,
        level: 'important',
        title: 'Lab result ready',
        body: `${order.patientName} · ${order.name} · ${summary.slice(0, 80)}`,
        module: 'doctor-portal',
      });
    } catch { /* ignore */ }
  }
  return order;
}

/** Can this order's result/dispense be released? */
export function canReleaseOrder(orderId: string): { ok: boolean; reason?: string; amountNgn?: number } {
  const pay = isOrderBillCleared(orderId);
  if (!pay.cleared) {
    return {
      ok: false,
      reason: `Awaiting payment · ₦${pay.amountNgn.toLocaleString()} at Accounts`,
      amountNgn: pay.amountNgn,
    };
  }
  return { ok: true };
}

/** Pre-order BPA (Epic-style) — call before placeOrder; non-blocking unless hard_stop handled by UI */
export function previewOrderBpa(input: {
  facilityId: string;
  patientId: string;
  type: ClinicalOrderType;
  code: string;
  name: string;
  priority?: string;
}) {
  return evaluateOrderBpa(input);
}

export function subscribeOrders(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener('medcore-clinical-orders', fn);
  window.addEventListener('storage', fn);
  window.addEventListener('medcore-admin-sync', fn);
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel('medcore_clinical');
    bc.onmessage = () => cb();
  } catch { /* ignore */ }
  return () => {
    window.removeEventListener('medcore-clinical-orders', fn);
    window.removeEventListener('storage', fn);
    window.removeEventListener('medcore-admin-sync', fn);
    try { bc?.close(); } catch { /* ignore */ }
  };
}
