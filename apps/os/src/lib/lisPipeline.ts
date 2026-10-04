/** LIS specimen pipeline + barcode + TAT */
import { listOrders, updateOrderStatus, type ClinicalOrder } from './clinicalEventBus';
import { publishFacilityData } from './roleSyncBus';

export type LisStage = 'ordered' | 'collected' | 'received' | 'processing' | 'verified' | 'resulted';

export interface SpecimenRecord {
  id: string;
  facilityId: string;
  orderId: string;
  barcode: string;
  patientName: string;
  patientId: string;
  testName: string;
  stage: LisStage;
  collectedAt?: string;
  receivedAt?: string;
  processingAt?: string;
  verifiedAt?: string;
  resultedAt?: string;
  tatMinutes?: number;
  result?: string;
}

const KEY = 'medcore_os_lis_specimens_v1';
const EVT = 'medcore-lis';

function read(): SpecimenRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}
function write(list: SpecimenRecord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 3000)));
  window.dispatchEvent(new CustomEvent(EVT));
  publishFacilityData(list[0]?.facilityId || 'IGH-EKT', KEY, list);
}

export function barcodeFor(orderId: string) {
  return `LIS${orderId.replace(/\W/g, '').slice(-10).toUpperCase()}`;
}

export function ensureSpecimenFromOrder(o: ClinicalOrder): SpecimenRecord {
  const existing = read().find((s) => s.orderId === o.id);
  if (existing) return existing;
  const rec: SpecimenRecord = {
    id: `SP-${Date.now().toString(36)}`,
    facilityId: o.facilityId,
    orderId: o.id,
    barcode: barcodeFor(o.id),
    patientName: o.patientName,
    patientId: o.patientId,
    testName: o.name,
    stage: 'ordered',
  };
  write([rec, ...read()]);
  return rec;
}

export function listSpecimens(facilityId: string): SpecimenRecord[] {
  // Sync lab orders into specimens
  for (const o of listOrders(facilityId).filter((x) => x.type === 'lab')) {
    ensureSpecimenFromOrder(o);
  }
  return read().filter((s) => s.facilityId === facilityId);
}

export function advanceSpecimen(id: string, stage: LisStage, result?: string): SpecimenRecord | undefined {
  const list = read();
  const i = list.findIndex((s) => s.id === id);
  if (i < 0) return undefined;
  const now = new Date().toISOString();
  const s = { ...list[i], stage };
  if (stage === 'collected') s.collectedAt = now;
  if (stage === 'received') s.receivedAt = now;
  if (stage === 'processing') s.processingAt = now;
  if (stage === 'verified') s.verifiedAt = now;
  if (stage === 'resulted') {
    s.resultedAt = now;
    s.result = result || s.result;
    if (s.collectedAt) {
      s.tatMinutes = Math.round((Date.now() - new Date(s.collectedAt).getTime()) / 60000);
    }
    updateOrderStatus(s.orderId, 'resulted', { resultSummary: s.result, resultedBy: 'Lab' });
  }
  list[i] = s;
  write(list);
  return s;
}

export function lisTatStats(facilityId: string) {
  const done = listSpecimens(facilityId).filter((s) => s.tatMinutes != null);
  const avg = done.length ? Math.round(done.reduce((a, b) => a + (b.tatMinutes || 0), 0) / done.length) : 0;
  return { completed: done.length, avgTatMinutes: avg, open: listSpecimens(facilityId).filter((s) => s.stage !== 'resulted').length };
}

export function subscribeLis(cb: () => void) {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}

export const LIS_KEY = KEY;
