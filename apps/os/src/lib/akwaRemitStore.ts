/**
 * AkwaRemit Central State Revenue Hub — MedCore Hospital OS
 *
 * Rule:
 * AkwaRemit is the central destination for all hospital money.
 * Every naira collected in the hospital (Cash, Paystack Terminal, Direct AkwaRemit)
 * must ultimately be accounted for and remitted through/into AkwaRemit.
 *
 * Three Supported Collection Methods:
 * 1. CASH: Patient gives physical cash -> Hospital later pays bulk cash into AkwaRemit via bank transfer/teller/portal -> Recorded: Amount + "Cash" + Date + Cashier + Shift.
 * 2. PAYSTACK TERMINAL: Card/USSD/Transfer on Paystack POS device -> Paystack settles into hospital account -> Hospital remits to AkwaRemit -> Recorded: Amount + Paystack Transaction Reference / RRN.
 * 3. DIRECT AKWAREMIT: Patient pays directly on AkwaRemit portal using RRR -> Money goes straight to AkwaRemit -> Recorded: Amount + AkwaRemit RRR / Receipt No -> Status: direct_akwaremit.
 *
 * Key Controls:
 * - Pre-exit payment recording
 * - Dual-control physical cash count (2 people count and sign)
 * - Paystack terminal reference capture
 * - Daily remittance report (Collections by method, In AkwaRemit vs Pending)
 * - Strict separation: Cashier (Collection) vs Finance Officer (Remittance)
 */

import { publishFacilityData } from './roleSyncBus';

export type AkwaRemitMethod =
  | 'akwaremit_pos'
  | 'cash'
  | 'bank_transfer'
  | 'direct_akwaremit'
  | 'credit_balance'
  | 'other';

export type AkwaRemitRemittanceStatus = 'pending' | 'remitted' | 'direct_akwaremit' | 'cancelled_to_credit';

export interface DynamicVirtualAccount {
  bankName: string;
  accountNumber: string;
  beneficiary: string;
  amountNgn: number;
  expiresAt: string;
}

export interface AkwaRemitPaymentRecord {
  id: string;
  arn: string; // Official AkwaRemit Reference Number
  receiptNo: string;
  facilityId: string;
  facilityName: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  amountNgn: number;
  method: AkwaRemitMethod;
  serviceCategory: 'consultation' | 'pharmacy' | 'laboratory' | 'radiology' | 'theatre' | 'admission' | 'general';
  description: string;
  // Audit References
  cashierName: string;
  cashierBadge: string;
  shiftId: string;
  terminalId?: string;
  rrn?: string;
  paystackRef?: string;
  // Dynamic Virtual Account for Bank Transfers
  virtualAccount?: DynamicVirtualAccount;
  // Exact Amount Validation
  exactAmountValidated?: boolean;
  status: 'pending' | 'paid' | 'cancelled_to_credit';
  paidAt?: string;
  webhookReceivedAt?: string;
  // AkwaRemit Remittance Tracking
  remittanceStatus: AkwaRemitRemittanceStatus;
  akwaRemitRrr?: string; // RRR of direct payment OR bulk remittance
  remittanceBatchId?: string; // Linked batch if remitted in bulk
  remittedAt?: string;
  remittedBy?: string;
  createdAt: string;
}

export interface ActiveCashierShift {
  id: string;
  facilityId: string;
  cashierName: string;
  cashierBadge: string;
  startingFloatNgn: number;
  openedAt: string;
  status: 'open' | 'closed';
  closedAt?: string;
}

export interface CashierUserShiftSummary {
  shiftId: string;
  cashierName: string;
  cashierBadge: string;
  openedAt: string;
  closedAt?: string;
  startingFloatNgn: number;
  totalCashNgn: number;
  cashTransactionsCount: number;
  totalPosArnsNgn: number;
  posTransactionsCount: number;
  totalTransfersNgn: number;
  transferTransactionsCount: number;
  totalCreditBalanceNgn: number;
  totalCollectionsNgn: number;
  expectedDrawerCashNgn: number;
  totalReceiptsCount: number;
}

export interface AkwaRemitBatchRecord {
  id: string;
  batchNumber: string;
  facilityId: string;
  facilityName: string;
  batchType: 'cash_bulk' | 'akwaremit_pos_settlement';
  periodDate: string; // YYYY-MM-DD
  paymentIds: string[];
  receiptNumbers: string[];
  totalAmountNgn: number;
  itemCount: number;
  // AkwaRemit Official Metadata
  akwaRemitRrr: string; // The official RRR generated on AkwaRemit portal
  bankName?: string;
  bankTellerRef?: string; // Bank deposit teller or transfer reference
  // Dual Control Sign-Off
  remittedBy: string; // Head of Accounts / Finance Officer
  remittedByBadge: string;
  witnessedBy: string; // Second officer / Auditor who verified count
  witnessedByBadge: string;
  status: 'draft' | 'remitted';
  evidenceDocRef?: string;
  notes?: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface AkwaRemitShiftCloseRecord {
  id: string;
  shiftId: string;
  facilityId: string;
  cashierName: string;
  cashierBadge: string;
  witnessName: string; // Dual control supervisor
  witnessBadge: string;
  shiftStart: string;
  shiftEnd: string;
  // System totals
  systemCashNgn: number;
  systemAkwaRemitPosNgn: number;
  systemDirectAkwaRemitNgn: number;
  totalSystemNgn: number;
  // Physical cash verification
  physicalCashCountedNgn: number;
  cashVarianceNgn: number; // physical - system (0 is balanced)
  denominations?: {
    n1000: number;
    n500: number;
    n200: number;
    n100: number;
    n50: number;
  };
  totalReceiptsIssued: number;
  notes?: string;
  closedAt: string;
}

export interface AkwaRemitDailySummary {
  facilityId: string;
  date: string;
  totalCollectionsNgn: number;
  cashTotalNgn: number;
  akwaremitPosTotalNgn: number;
  directAkwaRemitTotalNgn: number;
  // Remittance Status Breakdown
  alreadyInAkwaRemitNgn: number; // Remitted + Direct AkwaRemit
  pendingRemittanceNgn: number; // Cash and AkwaRemit POS awaiting bulk remittance
  complianceRatePercent: number; // alreadyInAkwaRemit / totalCollections * 100
  receiptsCount: number;
  pendingReceiptsCount: number;
  remittedReceiptsCount: number;
  directReceiptsCount: number;
}

export const AKWAREMIT_PAYMENTS_KEY = 'medcore_os_akwaremit_payments_v1';
export const AKWAREMIT_BATCHES_KEY = 'medcore_os_akwaremit_batches_v1';
export const AKWAREMIT_SHIFTS_KEY = 'medcore_os_akwaremit_shifts_v1';
export const AKWAREMIT_ACTIVE_SHIFTS_KEY = 'medcore_os_active_cashier_shifts_v1';
export const AKWAREMIT_EVENT = 'medcore-akwaremit-updated';

/**
 * Generate official AkwaRemit Reference Number (ARN)
 */
export function generateArn(facilityCode = 'AKW'): string {
  const year = new Date().getFullYear();
  const part1 = Math.floor(1000 + Math.random() * 9000);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `ARN-${year}-${part1}-${part2}`;
}

/**
 * Generate dynamic virtual bank account details tied 1:1 to an ARN
 */
export function generateDynamicVirtualAccount(
  arn: string,
  amountNgn: number,
  facilityName = 'Immanuel General Hospital'
): DynamicVirtualAccount {
  // Deterministic 10-digit virtual account from ARN digits
  const rawDigits = arn.replace(/\D/g, '');
  const suffix = (rawDigits + '00000000').slice(0, 8);
  const accountNumber = `99${suffix}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  return {
    bankName: 'Wema Bank (AkwaRemit TSA Collection)',
    accountNumber,
    beneficiary: `Akwa Ibom State Govt - ${facilityName}`,
    amountNgn,
    expiresAt,
  };
}

/**
 * Exact Amount Validation: Only accept exact invoice value matching AkwaRemit payload.
 * Partial payments are strictly forbidden for Bank Transfers and POS.
 */
export function validateExactAmount(receivedNgn: number, expectedNgn: number): boolean {
  return Math.abs(Math.round(receivedNgn) - Math.round(expectedNgn)) === 0;
}

// ─── Active Cashier Shift Storage Operations ────────────────────────────────

function readActiveShifts(): ActiveCashierShift[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AKWAREMIT_ACTIVE_SHIFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeActiveShifts(list: ActiveCashierShift[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AKWAREMIT_ACTIVE_SHIFTS_KEY, JSON.stringify(list.slice(-500)));
    window.dispatchEvent(new CustomEvent(AKWAREMIT_EVENT, { detail: { type: 'active_shifts' } }));
  } catch {
    /* ignore */
  }
}

/**
 * Open a cashier shift with starting cash float
 */
export function openCashierShift(params: {
  facilityId: string;
  cashierName: string;
  cashierBadge: string;
  startingFloatNgn: number;
}): ActiveCashierShift {
  const shifts = readActiveShifts();
  const id = `SHIFT-${Date.now().toString(36).toUpperCase()}-${params.cashierBadge || 'CASHIER'}`;
  const now = new Date().toISOString();

  // Close any previously open shift for this cashier
  const updated = shifts.map((s) => {
    if (s.cashierBadge === params.cashierBadge && s.status === 'open') {
      return { ...s, status: 'closed' as const, closedAt: now };
    }
    return s;
  });

  const newShift: ActiveCashierShift = {
    id,
    facilityId: params.facilityId,
    cashierName: params.cashierName,
    cashierBadge: params.cashierBadge,
    startingFloatNgn: Math.max(0, Number(params.startingFloatNgn) || 0),
    openedAt: now,
    status: 'open',
  };

  updated.unshift(newShift);
  writeActiveShifts(updated);
  return newShift;
}

/**
 * Get currently open shift for this cashier
 */
export function getActiveCashierShift(
  facilityId: string,
  cashierBadgeOrName: string
): ActiveCashierShift | null {
  const shifts = readActiveShifts();
  return (
    shifts.find(
      (s) =>
        s.facilityId === facilityId &&
        s.status === 'open' &&
        (s.cashierBadge === cashierBadgeOrName || s.cashierName === cashierBadgeOrName)
    ) || null
  );
}

/**
 * Generate End-of-Shift report strictly handled by that specific logged-in user
 */
export function getCashierUserShiftSummary(
  facilityId: string,
  cashierBadge: string,
  shiftId?: string
): CashierUserShiftSummary {
  const allShifts = readActiveShifts();
  const shift = shiftId
    ? allShifts.find((s) => s.id === shiftId)
    : allShifts.find((s) => s.cashierBadge === cashierBadge && s.status === 'open') || allShifts[0];

  const targetShiftId = shift?.id || 'SHIFT-OPEN';
  const startingFloatNgn = shift?.startingFloatNgn || 0;
  const openedAt = shift?.openedAt || new Date().toISOString();
  const cashierName = shift?.cashierName || cashierBadge;

  // Payments strictly by this cashier in this shift
  const payments = readPayments().filter(
    (p) =>
      p.facilityId === facilityId &&
      (p.cashierBadge === cashierBadge || p.cashierName === cashierName) &&
      (p.status === 'paid' || p.remittanceStatus === 'remitted' || p.remittanceStatus === 'direct_akwaremit')
  );

  let totalCashNgn = 0;
  let cashCount = 0;
  let totalPosArnsNgn = 0;
  let posCount = 0;
  let totalTransfersNgn = 0;
  let transferCount = 0;
  let totalCreditBalanceNgn = 0;

  for (const p of payments) {
    if (p.method === 'cash') {
      totalCashNgn += p.amountNgn;
      cashCount++;
    } else if (p.method === 'akwaremit_pos') {
      totalPosArnsNgn += p.amountNgn;
      posCount++;
    } else if (p.method === 'bank_transfer' || p.method === 'direct_akwaremit') {
      totalTransfersNgn += p.amountNgn;
      transferCount++;
    } else if (p.method === 'credit_balance') {
      totalCreditBalanceNgn += p.amountNgn;
    }
  }

  const totalCollectionsNgn = totalCashNgn + totalPosArnsNgn + totalTransfersNgn + totalCreditBalanceNgn;
  const expectedDrawerCashNgn = startingFloatNgn + totalCashNgn;

  return {
    shiftId: targetShiftId,
    cashierName,
    cashierBadge,
    openedAt,
    closedAt: shift?.closedAt,
    startingFloatNgn,
    totalCashNgn,
    cashTransactionsCount: cashCount,
    totalPosArnsNgn,
    posTransactionsCount: posCount,
    totalTransfersNgn,
    transferTransactionsCount: transferCount,
    totalCreditBalanceNgn,
    totalCollectionsNgn,
    expectedDrawerCashNgn,
    totalReceiptsCount: payments.length,
  };
}

function getDefaultPayments(): AkwaRemitPaymentRecord[] {
  return [];
}

function getDefaultBatches(): AkwaRemitBatchRecord[] {
  return [];
}

// ─── Storage Operations ─────────────────────────────────────────────────────

function readPayments(): AkwaRemitPaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AKWAREMIT_PAYMENTS_KEY);
    if (!raw) {
      return [];
    }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writePayments(list: AkwaRemitPaymentRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AKWAREMIT_PAYMENTS_KEY, JSON.stringify(list.slice(-5000)));
    window.dispatchEvent(new CustomEvent(AKWAREMIT_EVENT, { detail: { type: 'payments' } }));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: AKWAREMIT_PAYMENTS_KEY } }));
    const fid = list[0]?.facilityId || 'IGH-EKT';
    publishFacilityData(fid, AKWAREMIT_PAYMENTS_KEY, list);
  } catch {
    /* ignore */
  }
}

function readBatches(): AkwaRemitBatchRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AKWAREMIT_BATCHES_KEY);
    if (!raw) {
      return [];
    }
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeBatches(list: AkwaRemitBatchRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AKWAREMIT_BATCHES_KEY, JSON.stringify(list.slice(-1000)));
    window.dispatchEvent(new CustomEvent(AKWAREMIT_EVENT, { detail: { type: 'batches' } }));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: AKWAREMIT_BATCHES_KEY } }));
    const fid = list[0]?.facilityId || 'IGH-EKT';
    publishFacilityData(fid, AKWAREMIT_BATCHES_KEY, list);
  } catch {
    /* ignore */
  }
}

function readShifts(): AkwaRemitShiftCloseRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AKWAREMIT_SHIFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeShifts(list: AkwaRemitShiftCloseRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AKWAREMIT_SHIFTS_KEY, JSON.stringify(list.slice(-1000)));
    window.dispatchEvent(new CustomEvent(AKWAREMIT_EVENT, { detail: { type: 'shifts' } }));
    window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: AKWAREMIT_SHIFTS_KEY } }));
  } catch {
    /* ignore */
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function listAkwaRemitPayments(
  facilityId: string,
  filter?: {
    date?: string;
    method?: AkwaRemitMethod;
    status?: AkwaRemitRemittanceStatus;
    search?: string;
  }
): AkwaRemitPaymentRecord[] {
  let list = readPayments().filter((p) => !facilityId || p.facilityId === facilityId);

  if (filter?.date) {
    list = list.filter((p) => p.createdAt.startsWith(filter.date!));
  }
  if (filter?.method) {
    list = list.filter((p) => p.method === filter.method);
  }
  if (filter?.status) {
    list = list.filter((p) => p.remittanceStatus === filter.status);
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase().trim();
    list = list.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        p.hospitalNumber.toLowerCase().includes(q) ||
        p.receiptNo.toLowerCase().includes(q) ||
        (p.akwaRemitRrr && p.akwaRemitRrr.toLowerCase().includes(q)) ||
        (p.paystackRef && p.paystackRef.toLowerCase().includes(q))
    );
  }

  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAkwaRemitBatches(facilityId: string): AkwaRemitBatchRecord[] {
  return readBatches()
    .filter((b) => !facilityId || b.facilityId === facilityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listAkwaRemitShifts(facilityId: string): AkwaRemitShiftCloseRecord[] {
  return readShifts()
    .filter((s) => !facilityId || s.facilityId === facilityId)
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}

/**
 * Record a payment under AkwaRemit tracking
 */
export function recordAkwaRemitPayment(
  input: Omit<AkwaRemitPaymentRecord, 'id' | 'createdAt' | 'remittanceStatus' | 'arn' | 'status'> & {
    arn?: string;
    status?: 'pending' | 'paid' | 'cancelled_to_credit';
    remittanceStatus?: AkwaRemitRemittanceStatus;
  }
): AkwaRemitPaymentRecord {
  const list = readPayments();
  const id = `AKW-PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  // If method is direct_akwaremit, status is already direct_akwaremit
  let remittanceStatus: AkwaRemitRemittanceStatus = 'pending';
  if (input.method === 'direct_akwaremit') {
    remittanceStatus = 'direct_akwaremit';
  } else if (input.remittanceStatus) {
    remittanceStatus = input.remittanceStatus;
  }

  const record: AkwaRemitPaymentRecord = {
    ...input,
    id,
    arn: input.arn || generateArn(input.facilityId),
    status: input.status || 'paid',
    remittanceStatus,
    createdAt: new Date().toISOString(),
  };

  list.unshift(record);
  writePayments(list);
  return record;
}

/**
 * Compute the Daily Remittance Report summary
 */
export function getAkwaRemitDailySummary(facilityId: string, dateStr?: string): AkwaRemitDailySummary {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const payments = listAkwaRemitPayments(facilityId, { date });

  let totalCollections = 0;
  let cashTotal = 0;
  let posTotal = 0;
  let directTotal = 0;

  let alreadyInAkwaRemit = 0;
  let pendingRemittance = 0;

  let pendingCount = 0;
  let remittedCount = 0;
  let directCount = 0;

  for (const p of payments) {
    totalCollections += p.amountNgn;
    if (p.method === 'cash') cashTotal += p.amountNgn;
    else if (p.method === 'akwaremit_pos') posTotal += p.amountNgn;
    else if (p.method === 'direct_akwaremit') directTotal += p.amountNgn;

    if (p.remittanceStatus === 'remitted' || p.remittanceStatus === 'direct_akwaremit') {
      alreadyInAkwaRemit += p.amountNgn;
      if (p.remittanceStatus === 'remitted') remittedCount++;
      else directCount++;
    } else {
      pendingRemittance += p.amountNgn;
      pendingCount++;
    }
  }

  const complianceRate = totalCollections > 0 ? (alreadyInAkwaRemit / totalCollections) * 100 : 100;

  return {
    facilityId,
    date,
    totalCollectionsNgn: totalCollections,
    cashTotalNgn: cashTotal,
    akwaremitPosTotalNgn: posTotal,
    directAkwaRemitTotalNgn: directTotal,
    alreadyInAkwaRemitNgn: alreadyInAkwaRemit,
    pendingRemittanceNgn: pendingRemittance,
    complianceRatePercent: Math.round(complianceRate * 10) / 10,
    receiptsCount: payments.length,
    pendingReceiptsCount: pendingCount,
    remittedReceiptsCount: remittedCount,
    directReceiptsCount: directCount,
  };
}

/**
 * Create and execute an official bulk remittance to AkwaRemit
 */
export function executeAkwaRemitBatch(params: {
  facilityId: string;
  facilityName: string;
  batchType: 'cash_bulk' | 'akwaremit_pos_settlement';
  paymentIds: string[];
  akwaRemitRrr: string;
  bankName?: string;
  bankTellerRef?: string;
  remittedBy: string;
  remittedByBadge: string;
  witnessedBy: string;
  witnessedByBadge: string;
  notes?: string;
}): AkwaRemitBatchRecord {
  const allPayments = readPayments();
  const selectedPayments = allPayments.filter((p) => params.paymentIds.includes(p.id));

  if (selectedPayments.length === 0) {
    throw new Error('No payments selected for remittance');
  }

  const totalAmount = selectedPayments.reduce((sum, p) => sum + p.amountNgn, 0);
  const now = new Date().toISOString();
  const batchId = `AKW-BATCH-${Date.now().toString(36).toUpperCase()}`;
  const batchNumber = `AR-REM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Mark all included payments as remitted
  const updatedPayments = allPayments.map((p) => {
    if (params.paymentIds.includes(p.id)) {
      return {
        ...p,
        remittanceStatus: 'remitted' as const,
        akwaRemitRrr: params.akwaRemitRrr,
        remittanceBatchId: batchId,
        remittedAt: now,
        remittedBy: params.remittedBy,
      };
    }
    return p;
  });

  writePayments(updatedPayments);

  const batch: AkwaRemitBatchRecord = {
    id: batchId,
    batchNumber,
    facilityId: params.facilityId,
    facilityName: params.facilityName,
    batchType: params.batchType,
    periodDate: now.slice(0, 10),
    paymentIds: params.paymentIds,
    receiptNumbers: selectedPayments.map((p) => p.receiptNo),
    totalAmountNgn: totalAmount,
    itemCount: selectedPayments.length,
    akwaRemitRrr: params.akwaRemitRrr,
    bankName: params.bankName || 'Akwa Ibom State Revenue Account',
    bankTellerRef: params.bankTellerRef,
    remittedBy: params.remittedBy,
    remittedByBadge: params.remittedByBadge,
    witnessedBy: params.witnessedBy,
    witnessedByBadge: params.witnessedByBadge,
    status: 'remitted',
    notes: params.notes,
    createdAt: now,
    confirmedAt: now,
  };

  const batches = readBatches();
  batches.unshift(batch);
  writeBatches(batches);

  return batch;
}

/**
 * Execute Dual-Controlled Cash Count and Shift Closing
 */
export function closeCashierShiftDualControl(params: {
  shiftId: string;
  facilityId: string;
  cashierName: string;
  cashierBadge: string;
  witnessName: string;
  witnessBadge: string;
  shiftStart: string;
  shiftEnd: string;
  physicalCashCountedNgn: number;
  denominations?: {
    n1000: number;
    n500: number;
    n200: number;
    n100: number;
    n50: number;
  };
  notes?: string;
}): AkwaRemitShiftCloseRecord {
  const allPayments = readPayments().filter(
    (p) => p.facilityId === params.facilityId && p.shiftId === params.shiftId
  );

  let systemCash = 0;
  let systemPos = 0;
  let systemDirect = 0;

  for (const p of allPayments) {
    if (p.method === 'cash') systemCash += p.amountNgn;
    else if (p.method === 'akwaremit_pos') systemPos += p.amountNgn;
    else if (p.method === 'direct_akwaremit') systemDirect += p.amountNgn;
  }

  const totalSystem = systemCash + systemPos + systemDirect;
  const variance = params.physicalCashCountedNgn - systemCash;

  const record: AkwaRemitShiftCloseRecord = {
    id: `SHIFT-CLOSE-${Date.now().toString(36).toUpperCase()}`,
    shiftId: params.shiftId,
    facilityId: params.facilityId,
    cashierName: params.cashierName,
    cashierBadge: params.cashierBadge,
    witnessName: params.witnessName,
    witnessBadge: params.witnessBadge,
    shiftStart: params.shiftStart,
    shiftEnd: params.shiftEnd,
    systemCashNgn: systemCash,
    systemAkwaRemitPosNgn: systemPos,
    systemDirectAkwaRemitNgn: systemDirect,
    totalSystemNgn: totalSystem,
    physicalCashCountedNgn: params.physicalCashCountedNgn,
    cashVarianceNgn: variance,
    denominations: params.denominations,
    totalReceiptsIssued: allPayments.length,
    notes: params.notes,
    closedAt: new Date().toISOString(),
  };

  const shifts = readShifts();
  shifts.unshift(record);
  writeShifts(shifts);

  // Also close active shift if open
  const activeShifts = readActiveShifts().map((s) => {
    if (s.id === params.shiftId || (s.cashierBadge === params.cashierBadge && s.status === 'open')) {
      return { ...s, status: 'closed' as const, closedAt: new Date().toISOString() };
    }
    return s;
  });
  writeActiveShifts(activeShifts);

  return record;
}

/**
 * Cashier confirms physical cash was collected and logged as counter payment on AkwaRemit portal
 */
export function confirmAkwaRemitCashPayment(params: {
  arn: string;
  cashierName: string;
  cashierBadge: string;
  amountNgn: number;
}): { ok: boolean; payment?: AkwaRemitPaymentRecord; error?: string } {
  const all = readPayments();
  const idx = all.findIndex((p) => p.arn === params.arn);
  const now = new Date().toISOString();

  if (idx >= 0) {
    const existing = all[idx];
    if (!validateExactAmount(params.amountNgn, existing.amountNgn)) {
      return { ok: false, error: `Exact amount mismatch. Invoice requires ₦${existing.amountNgn.toLocaleString()}, received ₦${params.amountNgn.toLocaleString()}` };
    }
    const updated: AkwaRemitPaymentRecord = {
      ...existing,
      status: 'paid',
      paidAt: now,
      exactAmountValidated: true,
      remittanceStatus: 'pending',
    };
    all[idx] = updated;
    writePayments(all);
    return { ok: true, payment: updated };
  }

  return { ok: false, error: `ARN ${params.arn} not found in pending payments` };
}

/**
 * Process incoming AkwaRemit webhook (Bank Transfer received, POS approved, or Counter Cash)
 */
export function processAkwaRemitWebhookEvent(event: {
  arn: string;
  amountNgn: number;
  channel: AkwaRemitMethod;
  status: 'paid' | 'failed';
  transactionRef?: string;
  payerName?: string;
}): { ok: boolean; payment?: AkwaRemitPaymentRecord; error?: string } {
  const all = readPayments();
  const idx = all.findIndex((p) => p.arn === event.arn);

  if (idx < 0) {
    return { ok: false, error: `AkwaRemit ARN ${event.arn} not found` };
  }

  const existing = all[idx];

  // EXACT AMOUNT VALIDATION: Never allow partial payment entries to trigger Paid status
  if (!validateExactAmount(event.amountNgn, existing.amountNgn)) {
    return {
      ok: false,
      error: `EXACT_AMOUNT_MISMATCH: Invoice expects ₦${existing.amountNgn.toLocaleString()}, received ₦${event.amountNgn.toLocaleString()}`,
    };
  }

  const now = new Date().toISOString();
  const updated: AkwaRemitPaymentRecord = {
    ...existing,
    status: event.status === 'paid' ? 'paid' : 'pending',
    method: event.channel || existing.method,
    paidAt: event.status === 'paid' ? now : undefined,
    webhookReceivedAt: now,
    exactAmountValidated: true,
    remittanceStatus: event.channel === 'bank_transfer' ? 'direct_akwaremit' : existing.remittanceStatus,
    paystackRef: event.transactionRef,
  };

  all[idx] = updated;
  writePayments(all);
  return { ok: true, payment: updated };
}
