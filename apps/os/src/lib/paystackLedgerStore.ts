/**
 * Client-side ledger of Paystack payments + webhook confirmations.
 * Server webhook posts to /api/paystack/webhook; clients poll verify + merge here.
 */
import { publishFacilityData } from './roleSyncBus';
import { recordPayment } from './receptionOpsStore';
import { markPatientOutstandingPaid } from './patientBillingStore';
import { syncAccountsRequestsForPatientPayment } from './frontDeskAccountsBridge';
import { advanceClaimStatus, listClaims } from './arDeskStore';

export type LedgerStatus = 'pending' | 'success' | 'failed' | 'abandoned';

export interface PaystackLedgerEntry {
  id: string;
  facilityId: string;
  reference: string;
  amountNgn: number;
  status: LedgerStatus;
  channel?: string;
  patientId?: string;
  hospitalNumber?: string;
  patientName?: string;
  purpose?: string;
  claimId?: string;
  paidAt?: string;
  source: 'initialize' | 'verify' | 'webhook' | 'manual';
  raw?: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = 'medcore_os_paystack_ledger_v1';
const EVT = 'medcore-paystack-ledger';

function read(): PaystackLedgerEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: PaystackLedgerEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 2000)));
  window.dispatchEvent(new CustomEvent(EVT, { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  try {
    publishFacilityData(list[0]?.facilityId || 'IGH-EKT', KEY, list);
  } catch {
    /* */
  }
}

export function listPaystackLedger(facilityId: string): PaystackLedgerEntry[] {
  return read()
    .filter((e) => e.facilityId === facilityId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertPaystackLedger(
  input: Omit<PaystackLedgerEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): PaystackLedgerEntry {
  const now = new Date().toISOString();
  const all = read();
  const byRef = all.findIndex((e) => e.reference === input.reference && e.facilityId === input.facilityId);
  if (byRef >= 0) {
    all[byRef] = {
      ...all[byRef],
      ...input,
      updatedAt: now,
      paidAt: input.status === 'success' ? input.paidAt || now : all[byRef].paidAt,
    };
    write(all);
    return all[byRef];
  }
  const row: PaystackLedgerEntry = {
    ...input,
    id: input.id || `PS-${Date.now().toString(36).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
  };
  write([row, ...all]);
  return row;
}

/** Apply a verified Paystack success into hospital cash + bills + optional claim */
export function applyPaystackSuccess(input: {
  facilityId: string;
  reference: string;
  amountNgn: number;
  channel?: string;
  patientId?: string;
  hospitalNumber?: string;
  patientName?: string;
  purpose?: string;
  claimId?: string;
  actorName?: string;
  source: PaystackLedgerEntry['source'];
}): PaystackLedgerEntry {
  const entry = upsertPaystackLedger({
    facilityId: input.facilityId,
    reference: input.reference,
    amountNgn: input.amountNgn,
    status: 'success',
    channel: input.channel,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    purpose: input.purpose,
    claimId: input.claimId,
    paidAt: new Date().toISOString(),
    source: input.source,
  });

  try {
    recordPayment({
      facilityId: input.facilityId,
      patientId: input.patientId || input.hospitalNumber || 'unknown',
      hospitalNumber: input.hospitalNumber || '',
      patientName: input.patientName || 'Patient',
      amount: input.amountNgn,
      method: input.channel === 'card' ? 'card' : 'pos',
      purpose: input.purpose || `Paystack ${input.reference}`,
      cashier: input.actorName || 'Paystack',
      reference: input.reference,
    });
  } catch {
    /* */
  }

  try {
    const pid = input.patientId || input.hospitalNumber || '';
    if (pid) {
      markPatientOutstandingPaid(input.facilityId, pid, {
        via: 'paystack',
        paidBy: input.actorName || 'Paystack',
        paymentRef: input.reference,
      });
      syncAccountsRequestsForPatientPayment(input.facilityId, pid, {
        reference: input.reference,
        via: 'paystack',
        paidBy: input.actorName || 'Paystack',
      });
    }
  } catch {
    /* */
  }

  try {
    if (input.claimId) {
      advanceClaimStatus(input.claimId, 'paid', {
        claimRef: input.reference,
        actorName: input.actorName || 'Paystack',
      });
    }
  } catch {
    /* */
  }

  return entry;
}

export function subscribePaystackLedger(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('storage', fn);
  };
}
