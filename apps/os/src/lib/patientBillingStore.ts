/**
 * Patient hospital bill lines — pharmacy Rx, consult, lab, etc.
 * Default: pay at main cashier; pharmacy can also take payment.
 */
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';

export type BillLineStatus = 'unpaid' | 'paid' | 'hmo' | 'waived' | 'partial';
export type BillLineSource = 'pharmacy' | 'lab' | 'consult' | 'other' | 'opd';

export interface PatientBillLine {
  id: string;
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  source: BillLineSource;
  description: string;
  amountNgn: number;
  status: BillLineStatus;
  orderId?: string; // clinical order / Rx id
  paidAt?: string;
  paidVia?: 'cashier' | 'pharmacy' | 'hmo' | 'waiver';
  paidBy?: string;
  paymentRef?: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = 'medcore_os_patient_bills_v1';
const EVT = 'medcore-patient-bills';

/** Simple default drug fee when no formulary price — adjustable later */
export const DEFAULT_RX_FEE_NGN = 2500;

function read(): PatientBillLine[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: PatientBillLine[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 3000)));
  window.dispatchEvent(new CustomEvent(EVT, { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  publishFacilityData(fid, KEY, list);
}

export function listBillLines(facilityId: string, opts?: { patientId?: string; status?: BillLineStatus; orderId?: string }): PatientBillLine[] {
  let list = read().filter((l) => l.facilityId === facilityId);
  if (opts?.patientId) {
    list = list.filter(
      (l) => l.patientId === opts.patientId || l.hospitalNumber === opts.patientId
    );
  }
  if (opts?.status) list = list.filter((l) => l.status === opts.status);
  if (opts?.orderId) list = list.filter((l) => l.orderId === opts.orderId);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLineForOrder(orderId: string): PatientBillLine | undefined {
  return read().find((l) => l.orderId === orderId);
}

export function addBillLine(
  input: Omit<PatientBillLine, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: BillLineStatus }
): PatientBillLine {
  const now = new Date().toISOString();
  const line: PatientBillLine = {
    ...input,
    id: `BILL-${Date.now().toString(36).toUpperCase()}`,
    status: input.status || 'unpaid',
    createdAt: now,
    updatedAt: now,
  };
  write([line, ...read()]);
  return line;
}

/** Create pharmacy bill line when doctor sends Rx */
export function billPharmacyRx(input: {
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  orderId: string;
  drugName: string;
  amountNgn?: number;
}): PatientBillLine {
  const existing = getLineForOrder(input.orderId);
  if (existing) return existing;
  return addBillLine({
    facilityId: input.facilityId,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    source: 'pharmacy',
    description: `Pharmacy · ${input.drugName}`,
    amountNgn: input.amountNgn ?? DEFAULT_RX_FEE_NGN,
    orderId: input.orderId,
    status: 'unpaid',
  });
}

export function markLinePaid(
  lineId: string,
  opts: {
    via: PatientBillLine['paidVia'];
    paidBy?: string;
    paymentRef?: string;
    status?: BillLineStatus;
  }
): PatientBillLine | undefined {
  const list = read();
  const i = list.findIndex((l) => l.id === lineId);
  if (i < 0) return undefined;
  list[i] = {
    ...list[i],
    status: opts.status || 'paid',
    paidAt: new Date().toISOString(),
    paidVia: opts.via,
    paidBy: opts.paidBy,
    paymentRef: opts.paymentRef,
    updatedAt: new Date().toISOString(),
  };
  write(list);
  return list[i];
}

export function markOrderPaid(
  orderId: string,
  opts: {
    via: PatientBillLine['paidVia'];
    paidBy?: string;
    paymentRef?: string;
    status?: BillLineStatus;
  }
): PatientBillLine | undefined {
  const line = getLineForOrder(orderId);
  if (!line) return undefined;
  return markLinePaid(line.id, opts);
}

export function canDispenseOrder(orderId: string): {
  ok: boolean;
  reason: string;
  line?: PatientBillLine;
} {
  const line = getLineForOrder(orderId);
  if (!line) {
    // No bill line (legacy order) — allow with note
    return { ok: true, reason: 'No bill line — legacy order allowed' };
  }
  if (line.status === 'paid' || line.status === 'hmo' || line.status === 'waived') {
    return { ok: true, reason: `Bill ${line.status}`, line };
  }
  if (line.status === 'partial') {
    return { ok: false, reason: 'Partial payment — settle balance at cashier or pharmacy', line };
  }
  return {
    ok: false,
    reason: `Unpaid ₦${line.amountNgn.toLocaleString()} — pay at cashier or pharmacy`,
    line,
  };
}

export function patientBalance(facilityId: string, patientId: string): number {
  return listBillLines(facilityId, { patientId })
    .filter((l) => l.status === 'unpaid' || l.status === 'partial')
    .reduce((s, l) => s + l.amountNgn, 0);
}

export function subscribeBills(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('storage', fn);
  window.addEventListener('medcore-admin-sync', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('storage', fn);
    window.removeEventListener('medcore-admin-sync', fn);
  };
}
