/**
 * Patient hospital wallet — deposit once, auto-deduct on lab/Rx/services.
 */
import { publishFacilityData } from './roleSyncBus';

export type WalletTxnType = 'deposit' | 'deduct' | 'refund' | 'adjust';
export type WalletChannel = 'cash' | 'pos' | 'transfer' | 'moniepoint' | 'opay' | 'paystack' | 'other';

export interface WalletTxn {
  id: string;
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  type: WalletTxnType;
  amountNgn: number;
  balanceAfter: number;
  channel?: WalletChannel;
  note?: string;
  orderId?: string;
  billLineId?: string;
  actorName?: string;
  createdAt: string;
}

export interface PatientWallet {
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  balanceNgn: number;
  updatedAt: string;
}

const W_KEY = 'medcore_patient_wallets_v1';
const T_KEY = 'medcore_patient_wallet_txns_v1';
const EVT = 'medcore-wallet-sync';

function readWallets(): PatientWallet[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(W_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeWallets(list: PatientWallet[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(W_KEY, JSON.stringify(list.slice(0, 20000)));
  window.dispatchEvent(new CustomEvent(EVT));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(fid, W_KEY, list);
  } catch {
    /* ignore */
  }
}
function readTxns(): WalletTxn[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(T_KEY) || '[]');
  } catch {
    return [];
  }
}
function writeTxns(list: WalletTxn[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(T_KEY, JSON.stringify(list.slice(0, 30000)));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function getWallet(facilityId: string, patientId: string): PatientWallet | null {
  return (
    readWallets().find(
      (w) => w.facilityId === facilityId && (w.patientId === patientId || w.hospitalNumber === patientId)
    ) || null
  );
}

export function listWalletTxns(facilityId: string, patientId?: string): WalletTxn[] {
  let list = readTxns().filter((t) => t.facilityId === facilityId);
  if (patientId) {
    list = list.filter((t) => t.patientId === patientId || t.hospitalNumber === patientId);
  }
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function upsertWallet(w: PatientWallet) {
  const all = readWallets().filter(
    (x) => !(x.facilityId === w.facilityId && x.patientId === w.patientId)
  );
  writeWallets([w, ...all]);
}

export function depositWallet(input: {
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  amountNgn: number;
  channel: WalletChannel;
  actorName?: string;
  note?: string;
}): { ok: boolean; wallet?: PatientWallet; txn?: WalletTxn; error?: string } {
  const amt = Math.round(Number(input.amountNgn) || 0);
  if (amt <= 0) return { ok: false, error: 'Deposit amount must be > 0' };
  const prev = getWallet(input.facilityId, input.patientId);
  const balance = (prev?.balanceNgn || 0) + amt;
  const now = new Date().toISOString();
  const wallet: PatientWallet = {
    facilityId: input.facilityId,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    balanceNgn: balance,
    updatedAt: now,
  };
  const txn: WalletTxn = {
    id: `WT-${Date.now().toString(36)}`,
    facilityId: input.facilityId,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    type: 'deposit',
    amountNgn: amt,
    balanceAfter: balance,
    channel: input.channel,
    note: input.note || 'Wallet deposit',
    actorName: input.actorName,
    createdAt: now,
  };
  upsertWallet(wallet);
  writeTxns([txn, ...readTxns()]);
  return { ok: true, wallet, txn };
}

/**
 * Auto-deduct when lab/Rx/service is ordered. Fails soft if insufficient funds.
 */
export function tryAutoDeduct(input: {
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  amountNgn: number;
  orderId?: string;
  billLineId?: string;
  note?: string;
  actorName?: string;
}): { ok: boolean; deducted: boolean; wallet?: PatientWallet; txn?: WalletTxn; shortfallNgn?: number; error?: string } {
  const amt = Math.round(Number(input.amountNgn) || 0);
  if (amt <= 0) return { ok: true, deducted: false };
  const prev = getWallet(input.facilityId, input.patientId);
  const bal = prev?.balanceNgn || 0;
  if (bal < amt) {
    return {
      ok: false,
      deducted: false,
      wallet: prev || undefined,
      shortfallNgn: amt - bal,
      error: `Wallet balance ₦${bal.toLocaleString()} is short by ₦${(amt - bal).toLocaleString()}`,
    };
  }
  const balance = bal - amt;
  const now = new Date().toISOString();
  const wallet: PatientWallet = {
    facilityId: input.facilityId,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    balanceNgn: balance,
    updatedAt: now,
  };
  const txn: WalletTxn = {
    id: `WT-${Date.now().toString(36)}`,
    facilityId: input.facilityId,
    patientId: input.patientId,
    hospitalNumber: input.hospitalNumber,
    patientName: input.patientName,
    type: 'deduct',
    amountNgn: amt,
    balanceAfter: balance,
    orderId: input.orderId,
    billLineId: input.billLineId,
    note: input.note || 'Auto-deduct for service',
    actorName: input.actorName,
    createdAt: now,
  };
  upsertWallet(wallet);
  writeTxns([txn, ...readTxns()]);
  return { ok: true, deducted: true, wallet, txn };
}
