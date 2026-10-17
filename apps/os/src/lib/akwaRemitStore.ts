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

export type AkwaRemitMethod = 'cash' | 'paystack_terminal' | 'direct_akwaremit' | 'other';

export type AkwaRemitRemittanceStatus = 'pending' | 'remitted' | 'direct_akwaremit';

export interface AkwaRemitPaymentRecord {
  id: string;
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
  paystackRef?: string; // Required for paystack_terminal
  terminalId?: string;
  rrn?: string;
  // AkwaRemit Remittance Tracking
  remittanceStatus: AkwaRemitRemittanceStatus;
  akwaRemitRrr?: string; // RRR of direct payment OR bulk remittance
  remittanceBatchId?: string; // Linked batch if remitted in bulk
  remittedAt?: string;
  remittedBy?: string;
  createdAt: string;
}

export interface AkwaRemitBatchRecord {
  id: string;
  batchNumber: string;
  facilityId: string;
  facilityName: string;
  batchType: 'cash_bulk' | 'paystack_settlement';
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
  systemPaystackNgn: number;
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
  paystackTerminalTotalNgn: number;
  directAkwaRemitTotalNgn: number;
  // Remittance Status Breakdown
  alreadyInAkwaRemitNgn: number; // Remitted + Direct AkwaRemit
  pendingRemittanceNgn: number; // Cash and Paystack awaiting bulk remittance
  complianceRatePercent: number; // alreadyInAkwaRemit / totalCollections * 100
  receiptsCount: number;
  pendingReceiptsCount: number;
  remittedReceiptsCount: number;
  directReceiptsCount: number;
}

export const AKWAREMIT_PAYMENTS_KEY = 'medcore_os_akwaremit_payments_v1';
export const AKWAREMIT_BATCHES_KEY = 'medcore_os_akwaremit_batches_v1';
export const AKWAREMIT_SHIFTS_KEY = 'medcore_os_akwaremit_shifts_v1';
export const AKWAREMIT_EVENT = 'medcore-akwaremit-updated';

// ─── Default Sample Data for Realistic Hospital Experience ───────────────────
function getDefaultPayments(): AkwaRemitPaymentRecord[] {
  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      id: 'AKW-PAY-001',
      receiptNo: 'RCP-2026-0881',
      facilityId: 'IGH-EKT',
      facilityName: 'Immanuel General Hospital, Eket',
      patientId: 'P-001',
      patientName: 'Mrs. Amaka Okafor',
      hospitalNumber: 'MRN-20-14321',
      amountNgn: 4500,
      method: 'cash',
      serviceCategory: 'consultation',
      description: 'General OPD Medical Consultation + Routine Triage',
      cashierName: 'Mrs. Funke Adeyemi',
      cashierBadge: 'RCP-01208',
      shiftId: `SHIFT-${today}-MORNING`,
      remittanceStatus: 'remitted',
      akwaRemitRrr: 'RRR-2401-9984-2101',
      remittanceBatchId: 'AKW-BATCH-2026-001',
      remittedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      remittedBy: 'Mr. Chinedu Okoro (Finance Officer)',
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'AKW-PAY-002',
      receiptNo: 'RCP-2026-0882',
      facilityId: 'IGH-EKT',
      facilityName: 'Immanuel General Hospital, Eket',
      patientId: 'P-002',
      patientName: 'Mr. Tunde Yusuf',
      hospitalNumber: 'MRN-21-08834',
      amountNgn: 18500,
      method: 'paystack_terminal',
      serviceCategory: 'laboratory',
      description: 'Comprehensive Blood Panel + Renal Function Test',
      cashierName: 'Mrs. Funke Adeyemi',
      cashierBadge: 'RCP-01208',
      shiftId: `SHIFT-${today}-MORNING`,
      paystackRef: 'pstk_pos_99182310192',
      terminalId: 'PSTK-TRM-04',
      rrn: '009182746152',
      remittanceStatus: 'remitted',
      akwaRemitRrr: 'RRR-2401-9984-2102',
      remittanceBatchId: 'AKW-BATCH-2026-002',
      remittedAt: new Date(Date.now() - 3600000).toISOString(),
      remittedBy: 'Mr. Chinedu Okoro (Finance Officer)',
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'AKW-PAY-003',
      receiptNo: 'RCP-2026-0883',
      facilityId: 'IGH-EKT',
      facilityName: 'Immanuel General Hospital, Eket',
      patientId: 'P-003',
      patientName: 'Master Kufre Bassey',
      hospitalNumber: 'MRN-22-04912',
      amountNgn: 12000,
      method: 'direct_akwaremit',
      serviceCategory: 'admission',
      description: 'Pediatric Ward Observation Deposit',
      cashierName: 'Mrs. Funke Adeyemi',
      cashierBadge: 'RCP-01208',
      shiftId: `SHIFT-${today}-MORNING`,
      remittanceStatus: 'direct_akwaremit',
      akwaRemitRrr: 'RRR-AKW-9812-7462-09',
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'AKW-PAY-004',
      receiptNo: 'RCP-2026-0884',
      facilityId: 'IGH-EKT',
      facilityName: 'Immanuel General Hospital, Eket',
      patientId: 'P-004',
      patientName: 'Mrs. Blessing Udoh',
      hospitalNumber: 'MRN-23-11048',
      amountNgn: 8500,
      method: 'cash',
      serviceCategory: 'pharmacy',
      description: 'Antihypertensive Formulary Pack (Amlodipine + Lisinopril)',
      cashierName: 'Mrs. Funke Adeyemi',
      cashierBadge: 'RCP-01208',
      shiftId: `SHIFT-${today}-AFTERNOON`,
      remittanceStatus: 'pending',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'AKW-PAY-005',
      receiptNo: 'RCP-2026-0885',
      facilityId: 'IGH-EKT',
      facilityName: 'Immanuel General Hospital, Eket',
      patientId: 'P-005',
      patientName: 'Elder Effiong Akpan',
      hospitalNumber: 'MRN-19-00291',
      amountNgn: 25000,
      method: 'paystack_terminal',
      serviceCategory: 'radiology',
      description: 'Abdominal & Pelvic Ultrasound + Chest X-Ray Digital',
      cashierName: 'Mrs. Funke Adeyemi',
      cashierBadge: 'RCP-01208',
      shiftId: `SHIFT-${today}-AFTERNOON`,
      paystackRef: 'pstk_pos_44810928471',
      terminalId: 'PSTK-TRM-04',
      rrn: '009182749912',
      remittanceStatus: 'pending',
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ];
}

function getDefaultBatches(): AkwaRemitBatchRecord[] {
  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      id: 'AKW-BATCH-2026-001',
      batchNumber: 'AR-REM-2026-041',
      facilityId: 'IGH-EKT',
      facilityName: 'Immanuel General Hospital, Eket',
      batchType: 'cash_bulk',
      periodDate: today,
      paymentIds: ['AKW-PAY-001'],
      receiptNumbers: ['RCP-2026-0881'],
      totalAmountNgn: 4500,
      itemCount: 1,
      akwaRemitRrr: 'RRR-2401-9984-2101',
      bankName: 'Zenith Bank PLC (Akwa Ibom State Revenue Acct)',
      bankTellerRef: 'TELL-AKW-8819203',
      remittedBy: 'Mr. Chinedu Okoro',
      remittedByBadge: 'ADM-00001',
      witnessedBy: 'Pharm. Ibrahim Musa',
      witnessedByBadge: 'PHR-00733',
      status: 'remitted',
      notes: 'Morning shift physical cash total deposited at bank branch and credited to AkwaRemit RRR.',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      confirmedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'AKW-BATCH-2026-002',
      batchNumber: 'AR-REM-2026-042',
      facilityId: 'IGH-EKT',
      facilityName: 'Immanuel General Hospital, Eket',
      batchType: 'paystack_settlement',
      periodDate: today,
      paymentIds: ['AKW-PAY-002'],
      receiptNumbers: ['RCP-2026-0882'],
      totalAmountNgn: 18500,
      itemCount: 1,
      akwaRemitRrr: 'RRR-2401-9984-2102',
      bankName: 'Paystack Central Settlement -> State Revenue',
      bankTellerRef: 'PSTK-SETTLE-BATCH-9941',
      remittedBy: 'Mr. Chinedu Okoro',
      remittedByBadge: 'ADM-00001',
      witnessedBy: 'Dr. Adewale Bello',
      witnessedByBadge: 'DOC-00421',
      status: 'remitted',
      notes: 'Paystack POS settlement transferred to State AkwaRemit collection treasury account.',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      confirmedAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ];
}

// ─── Storage Operations ─────────────────────────────────────────────────────

function readPayments(): AkwaRemitPaymentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(AKWAREMIT_PAYMENTS_KEY);
    if (!raw) {
      const def = getDefaultPayments();
      writePayments(def);
      return def;
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
      const def = getDefaultBatches();
      writeBatches(def);
      return def;
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
  input: Omit<AkwaRemitPaymentRecord, 'id' | 'createdAt' | 'remittanceStatus'> & {
    remittanceStatus?: AkwaRemitRemittanceStatus;
  }
): AkwaRemitPaymentRecord {
  const list = readPayments();
  const id = `AKW-PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  // If method is direct_akwaremit, status is already direct_akwaremit
  let status: AkwaRemitRemittanceStatus = 'pending';
  if (input.method === 'direct_akwaremit') {
    status = 'direct_akwaremit';
  } else if (input.remittanceStatus) {
    status = input.remittanceStatus;
  }

  const record: AkwaRemitPaymentRecord = {
    ...input,
    id,
    remittanceStatus: status,
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
  let paystackTotal = 0;
  let directTotal = 0;

  let alreadyInAkwaRemit = 0;
  let pendingRemittance = 0;

  let pendingCount = 0;
  let remittedCount = 0;
  let directCount = 0;

  for (const p of payments) {
    totalCollections += p.amountNgn;
    if (p.method === 'cash') cashTotal += p.amountNgn;
    else if (p.method === 'paystack_terminal') paystackTotal += p.amountNgn;
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
    paystackTerminalTotalNgn: paystackTotal,
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
  batchType: 'cash_bulk' | 'paystack_settlement';
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
  let systemPaystack = 0;
  let systemDirect = 0;

  for (const p of allPayments) {
    if (p.method === 'cash') systemCash += p.amountNgn;
    else if (p.method === 'paystack_terminal') systemPaystack += p.amountNgn;
    else if (p.method === 'direct_akwaremit') systemDirect += p.amountNgn;
  }

  const totalSystem = systemCash + systemPaystack + systemDirect;
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
    systemPaystackNgn: systemPaystack,
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

  return record;
}
