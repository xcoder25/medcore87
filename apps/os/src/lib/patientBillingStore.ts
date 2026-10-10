/**
 * Patient hospital bill lines — pharmacy Rx, consult, lab, etc.
 * Default: pay at main cashier; pharmacy can also take payment.
 */
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';

export type BillLineStatus = 'unpaid' | 'paid' | 'hmo' | 'waived' | 'partial';
export type BillLineSource = 'pharmacy' | 'lab' | 'consult' | 'other' | 'opd' | 'billing' | 'imaging';

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
  paidVia?: 'cashier' | 'pharmacy' | 'hmo' | 'waiver' | 'paystack';
  paidBy?: string;
  paymentRef?: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = 'medcore_os_patient_bills_v1';
const EVT = 'medcore-patient-bills';

/** Simple default drug fee when no formulary price — adjustable later */
export const DEFAULT_RX_FEE_NGN = 2500;
export const DEFAULT_LAB_FEE_NGN = 3500;
export const DEFAULT_IMAGING_FEE_NGN = 8000;

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
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 15000)));
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

/** Lab/Rx/Imaging may release results only when linked bill is paid/waived/hmo (or no bill) */
export function isOrderBillCleared(orderId: string): { cleared: boolean; amountNgn: number; status?: BillLineStatus } {
  const line = getLineForOrder(orderId);
  if (!line) return { cleared: true, amountNgn: 0 };
  if (line.status === 'paid' || line.status === 'waived' || line.status === 'hmo') {
    return { cleared: true, amountNgn: line.amountNgn, status: line.status };
  }
  return { cleared: false, amountNgn: line.amountNgn, status: line.status };
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

export function billLabOrder(input: {
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  orderId: string;
  testName: string;
  amountNgn?: number;
}): PatientBillLine {
  const existing = getLineForOrder(input.orderId);
  if (existing) return existing;
  return addBillLine({
    facilityId: input.facilityId,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    source: 'lab',
    description: `Laboratory · ${input.testName}`,
    amountNgn: input.amountNgn ?? DEFAULT_LAB_FEE_NGN,
    orderId: input.orderId,
    status: 'unpaid',
  });
}

export function billImagingOrder(input: {
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  orderId: string;
  studyName: string;
  amountNgn?: number;
}): PatientBillLine {
  const existing = getLineForOrder(input.orderId);
  if (existing) return existing;
  return addBillLine({
    facilityId: input.facilityId,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    source: 'other',
    description: `Imaging · ${input.studyName}`,
    amountNgn: input.amountNgn ?? DEFAULT_IMAGING_FEE_NGN,
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
  // Mirror settlement onto billing-office invoice when this line came from an invoice
  try {
    syncInvoiceFromBillLine(list[i]);
  } catch {
    /* ignore */
  }
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

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('medcore-order-paid', { detail: { orderId } })
      );
    }
  } catch { /* ignore */ }
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


/** Mark all unpaid lines for a patient as paid (reception / Paystack settlement). */
export function markPatientOutstandingPaid(
  facilityId: string,
  patientId: string,
  opts: {
    via: PatientBillLine['paidVia'];
    paidBy?: string;
    paymentRef?: string;
  }
): PatientBillLine[] {
  const list = read();
  const now = new Date().toISOString();
  let changed = false;
  const updated = list.map((l) => {
    if (l.facilityId !== facilityId) return l;
    if (l.patientId !== patientId && l.hospitalNumber !== patientId) return l;
    if (l.status !== 'unpaid' && l.status !== 'partial') return l;
    changed = true;
    return {
      ...l,
      status: 'paid' as BillLineStatus,
      paidAt: now,
      paidVia: opts.via,
      paidBy: opts.paidBy,
      paymentRef: opts.paymentRef,
      updatedAt: now,
    };
  });
  if (changed) {
    write(updated);
    for (const l of updated) {
      if (
        l.facilityId === facilityId &&
        (l.patientId === patientId || l.hospitalNumber === patientId) &&
        l.paymentRef === opts.paymentRef
      ) {
        try {
          syncInvoiceFromBillLine(l);
        } catch {
          /* ignore */
        }
      }
    }
  }
  return updated.filter(
    (l) =>
      l.facilityId === facilityId &&
      (l.patientId === patientId || l.hospitalNumber === patientId) &&
      l.paymentRef === opts.paymentRef
  );
}


/** Billing office invoice storage — kept in sync with patient bill lines */
export const BILLING_INVOICE_STORAGE_KEY = 'ibom_os_billing_invoices';

function readInvoices(): Array<Record<string, unknown>> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BILLING_INVOICE_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeInvoices(list: Array<Record<string, unknown>>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(BILLING_INVOICE_STORAGE_KEY, JSON.stringify(list.slice(0, 2000)));
  window.dispatchEvent(new CustomEvent('medcore-billing-invoices', { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: BILLING_INVOICE_STORAGE_KEY } }));
}

/** When cashier pays a bill line that belongs to a billing-office invoice, mark invoice settled */
function syncInvoiceFromBillLine(line: PatientBillLine) {
  if (line.source !== 'billing' && !String(line.orderId || '').startsWith('INV-')) return;
  if (line.status !== 'paid' && line.status !== 'hmo' && line.status !== 'waived') return;
  const invKey = String(line.orderId || '');
  const list = readInvoices();
  let changed = false;
  const next = list.map((inv) => {
    const id = String(inv.id || '');
    const num = String(inv.invoiceNumber || '');
    if (id !== invKey && num !== invKey && `INV-${num}` !== invKey) return inv;
    changed = true;
    const copay = Number(inv.patientCopayNgn || inv.totalChargesNgn || line.amountNgn) || line.amountNgn;
    return {
      ...inv,
      status: 'settled',
      amountPaidNgn: copay,
      paymentMethod:
        line.paidVia === 'paystack'
          ? `Paystack · ${line.paymentRef || ''}`
          : line.paidVia === 'hmo'
            ? 'HMO / NHIS'
            : line.paidVia === 'waiver'
              ? 'Waiver'
              : `Cashier · ${line.paymentRef || line.paidBy || ''}`.trim(),
      settledAt: line.paidAt || new Date().toISOString(),
      settledVia: line.paidVia || 'cashier',
    };
  });
  if (changed) writeInvoices(next);
}

/**
 * Post a billing-office invoice to the shared ledger so Cashier / POS can collect.
 * Patient portion (copay) is what cashier sees as due.
 */
export function postInvoiceForPayment(input: {
  facilityId: string;
  invoiceId: string;
  invoiceNumber: string;
  patientId: string;
  hospitalNumber?: string;
  patientName: string;
  patientCopayNgn: number;
  totalChargesNgn?: number;
  hmoCoveredNgn?: number;
  department?: string;
  items?: Array<{ name: string; cost: number }>;
}): PatientBillLine {
  const orderId = input.invoiceId.startsWith('INV-') ? input.invoiceId : `INV-${input.invoiceId}`;
  const existing = getLineForOrder(orderId) || getLineForOrder(input.invoiceNumber);
  if (existing && (existing.status === 'unpaid' || existing.status === 'partial')) {
    return existing;
  }
  if (existing && existing.status === 'paid') {
    return existing;
  }
  const itemNote =
    input.items && input.items.length
      ? input.items.map((it) => it.name).filter(Boolean).slice(0, 4).join(', ')
      : input.department || 'Hospital bill';
  const amount = Math.max(0, Number(input.patientCopayNgn) || 0);
  return addBillLine({
    facilityId: input.facilityId,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber || input.patientId,
    patientName: input.patientName,
    source: 'billing',
    description: `${input.invoiceNumber} · ${itemNote}`,
    amountNgn: amount,
    orderId,
    status: amount > 0 ? 'unpaid' : 'paid',
  });
}

/** Void / remove open ledger line when billing voids an invoice */
export function voidInvoiceBillLine(invoiceId: string, invoiceNumber?: string): void {
  const keys = [invoiceId, invoiceNumber, invoiceId.startsWith('INV-') ? invoiceId : `INV-${invoiceId}`].filter(
    Boolean
  ) as string[];
  const list = read().filter((l) => {
    if (l.source !== 'billing') return true;
    if (keys.includes(String(l.orderId || ''))) return false;
    return true;
  });
  write(list);
}

/** All patients with open balances — for cashier queue */
export function listPatientsWithOpenBills(facilityId: string): Array<{
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  balanceNgn: number;
  lines: PatientBillLine[];
}> {
  const open = listBillLines(facilityId).filter((l) => l.status === 'unpaid' || l.status === 'partial');
  const map = new Map<string, PatientBillLine[]>();
  for (const l of open) {
    const key = l.patientId || l.hospitalNumber;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(l);
  }
  return Array.from(map.entries()).map(([patientId, lines]) => ({
    patientId,
    hospitalNumber: lines[0]?.hospitalNumber || patientId,
    patientName: lines[0]?.patientName || patientId,
    balanceNgn: lines.reduce((s, l) => s + l.amountNgn, 0),
    lines,
  }));
}

