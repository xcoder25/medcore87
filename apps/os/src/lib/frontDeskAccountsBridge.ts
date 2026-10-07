/**
 * Front desk ↔ Accounts digital handoff
 *
 * Reception opens a patient folder and sends a payment request to Accounts.
 * Patient pays at Accounting desk, then returns to front desk with receipt
 * for the next clinical step (queue / consult / lab).
 */
import { publishFacilityData } from './roleSyncBus';
import { postInvoiceForPayment, markPatientOutstandingPaid } from './patientBillingStore';

export const FD_ACCOUNTS_KEY = 'medcore_os_fd_accounts_requests_v1';
export const FD_ACCOUNTS_EVENT = 'medcore-fd-accounts';

export type AccountsRequestStatus =
  | 'awaiting_payment'
  | 'paid'
  | 'partial'
  | 'cancelled'
  | 'waived';

export type AccountsRequestSource =
  | 'registration'
  | 'folder_open'
  | 'opd_fee'
  | 'billing_office'
  | 'reception';

export interface FrontDeskAccountsRequest {
  id: string;
  facilityId: string;
  facilityName: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  amountNgn: number;
  purpose: string;
  source: AccountsRequestSource;
  status: AccountsRequestStatus;
  /** Linked bill line / invoice id when posted to ledger */
  billOrderId?: string;
  invoiceNumber?: string;
  sentBy: string;
  sentByBadge?: string;
  sentAt: string;
  paidAt?: string;
  paidReference?: string;
  paidVia?: string;
  paidBy?: string;
  /** Front desk notes for cashier */
  note?: string;
}

function read(): FrontDeskAccountsRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FD_ACCOUNTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: FrontDeskAccountsRequest[]) {
  if (typeof window === 'undefined') return;
  const next = list.slice(0, 2000);
  localStorage.setItem(FD_ACCOUNTS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(FD_ACCOUNTS_EVENT, { detail: next }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: FD_ACCOUNTS_KEY } }));
  const fid = next[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(fid, FD_ACCOUNTS_KEY, next);
  } catch {
    /* offline */
  }
}

export function listAccountsRequests(
  facilityId: string,
  opts?: { status?: AccountsRequestStatus | AccountsRequestStatus[]; patientId?: string }
): FrontDeskAccountsRequest[] {
  let list = read().filter((r) => r.facilityId === facilityId);
  if (opts?.status) {
    const st = Array.isArray(opts.status) ? opts.status : [opts.status];
    list = list.filter((r) => st.includes(r.status));
  }
  if (opts?.patientId) {
    list = list.filter(
      (r) => r.patientId === opts.patientId || r.hospitalNumber === opts.patientId
    );
  }
  return list.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

export function getAccountsRequest(id: string): FrontDeskAccountsRequest | undefined {
  return read().find((r) => r.id === id);
}

/**
 * Front desk: open folder / register → send invoice to Accounts for collection.
 */
export function sendPaymentRequestToAccounts(input: {
  facilityId: string;
  facilityName: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  amountNgn: number;
  purpose: string;
  source: AccountsRequestSource;
  sentBy: string;
  sentByBadge?: string;
  note?: string;
}): FrontDeskAccountsRequest {
  const invId = `INV-FD-${Date.now().toString(36).toUpperCase()}`;
  const invNum = `FD-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
  const amount = Math.max(0, Number(input.amountNgn) || 0);

  // Shared ledger so POS can collect
  try {
    postInvoiceForPayment({
      facilityId: input.facilityId,
      invoiceId: invId,
      invoiceNumber: invNum,
      patientId: input.patientId,
      hospitalNumber: input.hospitalNumber,
      patientName: input.patientName,
      patientCopayNgn: amount,
      totalChargesNgn: amount,
      department: 'Front desk',
      items: [{ name: input.purpose, cost: amount }],
    });
  } catch {
    /* still queue the request */
  }

  const row: FrontDeskAccountsRequest = {
    id: `FDAQ-${Date.now().toString(36).toUpperCase()}`,
    facilityId: input.facilityId,
    facilityName: input.facilityName,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    amountNgn: amount,
    purpose: input.purpose,
    source: input.source,
    status: amount > 0 ? 'awaiting_payment' : 'paid',
    billOrderId: invId,
    invoiceNumber: invNum,
    sentBy: input.sentBy,
    sentByBadge: input.sentByBadge,
    sentAt: new Date().toISOString(),
    note: input.note,
  };

  write([row, ...read().filter((r) => r.id !== row.id)]);
  return row;
}

/** Accounts marks request paid after POS collection (or links existing payment) */
export function markAccountsRequestPaid(
  id: string,
  opts: { reference: string; via?: string; paidBy?: string }
): FrontDeskAccountsRequest | undefined {
  const list = read();
  const i = list.findIndex((r) => r.id === id);
  if (i < 0) return undefined;
  const row = list[i];
  list[i] = {
    ...row,
    status: 'paid',
    paidAt: new Date().toISOString(),
    paidReference: opts.reference,
    paidVia: opts.via || 'cashier',
    paidBy: opts.paidBy,
  };
  write(list);
  try {
    markPatientOutstandingPaid(row.facilityId, row.patientId, {
      via: (opts.via as 'cashier') || 'cashier',
      paidBy: opts.paidBy,
      paymentRef: opts.reference,
    });
  } catch {
    /* ignore */
  }
  return list[i];
}

/** When POS settles a patient, sync matching awaiting requests → paid */
export function syncAccountsRequestsForPatientPayment(
  facilityId: string,
  patientId: string,
  opts: { reference: string; via?: string; paidBy?: string }
): void {
  const list = read();
  let changed = false;
  const next = list.map((r) => {
    if (r.facilityId !== facilityId) return r;
    if (r.patientId !== patientId && r.hospitalNumber !== patientId) return r;
    if (r.status !== 'awaiting_payment' && r.status !== 'partial') return r;
    changed = true;
    return {
      ...r,
      status: 'paid' as AccountsRequestStatus,
      paidAt: new Date().toISOString(),
      paidReference: opts.reference,
      paidVia: opts.via || 'cashier',
      paidBy: opts.paidBy,
    };
  });
  if (changed) write(next);
}

export function subscribeAccountsRequests(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(FD_ACCOUNTS_EVENT, fn);
  window.addEventListener('storage', fn);
  window.addEventListener('medcore-admin-sync', fn);
  return () => {
    window.removeEventListener(FD_ACCOUNTS_EVENT, fn);
    window.removeEventListener('storage', fn);
    window.removeEventListener('medcore-admin-sync', fn);
  };
}

/** Default folder-opening / registration fee (NGN) — adjustable later in settings */
export const DEFAULT_REGISTRATION_FEE_NGN = 2000;
