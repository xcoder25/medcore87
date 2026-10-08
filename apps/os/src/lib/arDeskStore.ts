/**
 * MedCore AR Desk — Nigeria + Epic/Cerner-style revenue cycle engine
 * Source of truth for displays: patient bills + FD accounts + payments + claims ledger
 * Realtime via localStorage + CustomEvent + facility publish
 */
import { publishFacilityData } from './roleSyncBus';
import {
  listBillLines,
  subscribeBills,
  type PatientBillLine,
  type BillLineStatus,
} from './patientBillingStore';
import {
  listAccountsRequests,
  subscribeAccountsRequests,
  type FrontDeskAccountsRequest,
} from './frontDeskAccountsBridge';
import { todayPayments, type ReceptionPayment } from './receptionOpsStore';

export type PayerType = 'cash' | 'hmo' | 'nhia' | 'corporate' | 'family';
export type ClaimStatus =
  | 'draft'
  | 'preauth_pending'
  | 'preauth_approved'
  | 'submitted'
  | 'queried'
  | 'paid'
  | 'denied'
  | 'appealed';
export type WorkItemType =
  | 'aged_debtor'
  | 'denied_claim'
  | 'missing_auth'
  | 'statement'
  | 'fd_awaiting'
  | 'partial_pay'
  | 'hmo_leakage';
export type WorkItemStatus = 'open' | 'in_progress' | 'done' | 'dismissed';

export interface ArClaim {
  id: string;
  facilityId: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  payerType: 'hmo' | 'nhia' | 'corporate';
  payerName: string;
  amountNgn: number;
  status: ClaimStatus;
  authCode?: string;
  claimRef?: string;
  tariffNote?: string;
  denialReason?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  paidAt?: string;
  actorName?: string;
}

export interface ArRemittance {
  id: string;
  facilityId: string;
  payerName: string;
  amountNgn: number;
  adviceRef: string;
  allocatedNgn: number;
  surplusNgn: number;
  note?: string;
  createdAt: string;
  actorName?: string;
}

export interface ArShiftClose {
  id: string;
  facilityId: string;
  deskId: string;
  cashier: string;
  expectedCashNgn: number;
  countedCashNgn: number;
  varianceNgn: number;
  posTotalNgn: number;
  transferTotalNgn: number;
  receiptCount: number;
  closedAt: string;
  note?: string;
}

export interface ArWorkItem {
  id: string;
  facilityId: string;
  type: WorkItemType;
  title: string;
  detail: string;
  patientId?: string;
  hospitalNumber?: string;
  amountNgn?: number;
  status: WorkItemStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export interface DebtorRow {
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  payerHint: PayerType;
  balanceNgn: number;
  oldestOpenAt: string;
  daysOutstanding: number;
  lineCount: number;
  partial: boolean;
  sources: string[];
}

export interface AgingBuckets {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90plus: number;
  byPayer: Record<PayerType, { d0_30: number; d31_60: number; d61_90: number; d90plus: number; total: number }>;
}

export interface ArDashboardSnapshot {
  facilityId: string;
  totalArNgn: number;
  cashArNgn: number;
  hmoArNgn: number;
  nhiaArNgn: number;
  corporateArNgn: number;
  collectedTodayNgn: number;
  cashTodayNgn: number;
  posTodayNgn: number;
  transferTodayNgn: number;
  receiptCountToday: number;
  fdAwaitingCount: number;
  fdAwaitingNgn: number;
  openClaims: number;
  deniedClaims: number;
  preauthPending: number;
  collectionRatePct: number;
  aging: AgingBuckets;
  debtors: DebtorRow[];
  workItems: ArWorkItem[];
  aiBrief: string;
  updatedAt: string;
}

const CLAIMS_KEY = 'medcore_os_ar_claims_v1';
const REMIT_KEY = 'medcore_os_ar_remit_v1';
const SHIFT_KEY = 'medcore_os_ar_shifts_v1';
const WORK_KEY = 'medcore_os_ar_work_v1';
const AR_EVT = 'medcore-ar-desk';

function readJson<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, list: T[], facilityId?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(list.slice(0, 3000)));
  window.dispatchEvent(new CustomEvent(AR_EVT, { detail: { key } }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key } }));
  try {
    publishFacilityData(facilityId || 'IGH-EKT', key, list);
  } catch {
    /* offline */
  }
}

function daysBetween(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function inferPayer(line: PatientBillLine, fd?: FrontDeskAccountsRequest[]): PayerType {
  if (line.status === 'hmo') return 'hmo';
  const desc = (line.description || '').toLowerCase();
  if (desc.includes('nhia') || desc.includes('nhis') || desc.includes('akshia')) return 'nhia';
  if (desc.includes('hmo') || desc.includes('hygeia') || desc.includes('avon')) return 'hmo';
  if (desc.includes('corporate') || desc.includes('company')) return 'corporate';
  if (desc.includes('family')) return 'family';
  const req = (fd || []).find(
    (r) => r.patientId === line.patientId || r.hospitalNumber === line.hospitalNumber
  );
  if (req?.purpose?.toLowerCase().includes('nhia')) return 'nhia';
  return 'cash';
}

function emptyPayerBuckets() {
  const z = { d0_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
  return {
    cash: { ...z },
    hmo: { ...z },
    nhia: { ...z },
    corporate: { ...z },
    family: { ...z },
  };
}

export function listClaims(facilityId: string): ArClaim[] {
  return readJson<ArClaim>(CLAIMS_KEY)
    .filter((c) => c.facilityId === facilityId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertClaim(input: Omit<ArClaim, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ArClaim {
  const now = new Date().toISOString();
  const all = readJson<ArClaim>(CLAIMS_KEY);
  if (input.id) {
    const i = all.findIndex((c) => c.id === input.id);
    if (i >= 0) {
      all[i] = { ...all[i], ...input, updatedAt: now };
      writeJson(CLAIMS_KEY, all, input.facilityId);
      return all[i];
    }
  }
  const row: ArClaim = {
    ...input,
    id: input.id || `CLM-${Date.now().toString(36).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
  };
  writeJson(CLAIMS_KEY, [row, ...all], input.facilityId);
  return row;
}

export function advanceClaimStatus(
  id: string,
  status: ClaimStatus,
  extra?: Partial<ArClaim>
): ArClaim | undefined {
  const all = readJson<ArClaim>(CLAIMS_KEY);
  const i = all.findIndex((c) => c.id === id);
  if (i < 0) return undefined;
  const now = new Date().toISOString();
  all[i] = {
    ...all[i],
    ...extra,
    status,
    updatedAt: now,
    submittedAt: status === 'submitted' ? now : all[i].submittedAt,
    paidAt: status === 'paid' ? now : all[i].paidAt,
  };
  writeJson(CLAIMS_KEY, all, all[i].facilityId);
  return all[i];
}

export function listRemittances(facilityId: string): ArRemittance[] {
  return readJson<ArRemittance>(REMIT_KEY)
    .filter((r) => r.facilityId === facilityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function postRemittance(input: Omit<ArRemittance, 'id' | 'createdAt' | 'surplusNgn'> & { surplusNgn?: number }): ArRemittance {
  const allocated = input.allocatedNgn || 0;
  const row: ArRemittance = {
    ...input,
    id: `RMT-${Date.now().toString(36).toUpperCase()}`,
    surplusNgn: input.surplusNgn ?? Math.max(0, input.amountNgn - allocated),
    createdAt: new Date().toISOString(),
  };
  writeJson(REMIT_KEY, [row, ...readJson<ArRemittance>(REMIT_KEY)], input.facilityId);
  return row;
}

export function listShiftCloses(facilityId: string): ArShiftClose[] {
  return readJson<ArShiftClose>(SHIFT_KEY)
    .filter((s) => s.facilityId === facilityId)
    .sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}

export function closeCashierShift(input: Omit<ArShiftClose, 'id' | 'varianceNgn' | 'closedAt'>): ArShiftClose {
  const row: ArShiftClose = {
    ...input,
    id: `SHF-${Date.now().toString(36).toUpperCase()}`,
    varianceNgn: input.countedCashNgn - input.expectedCashNgn,
    closedAt: new Date().toISOString(),
  };
  writeJson(SHIFT_KEY, [row, ...readJson<ArShiftClose>(SHIFT_KEY)], input.facilityId);
  return row;
}

export function listWorkItems(facilityId: string, status?: WorkItemStatus): ArWorkItem[] {
  let list = readJson<ArWorkItem>(WORK_KEY).filter((w) => w.facilityId === facilityId);
  if (status) list = list.filter((w) => w.status === status);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function upsertWorkItem(
  input: Omit<ArWorkItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): ArWorkItem {
  const now = new Date().toISOString();
  const all = readJson<ArWorkItem>(WORK_KEY);
  if (input.id) {
    const i = all.findIndex((w) => w.id === input.id);
    if (i >= 0) {
      all[i] = { ...all[i], ...input, updatedAt: now };
      writeJson(WORK_KEY, all, input.facilityId);
      return all[i];
    }
  }
  const row: ArWorkItem = {
    ...input,
    id: input.id || `WRK-${Date.now().toString(36).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
  };
  writeJson(WORK_KEY, [row, ...all], input.facilityId);
  return row;
}

export function setWorkItemStatus(id: string, status: WorkItemStatus): void {
  const all = readJson<ArWorkItem>(WORK_KEY);
  const i = all.findIndex((w) => w.id === id);
  if (i < 0) return;
  all[i] = { ...all[i], status, updatedAt: new Date().toISOString() };
  writeJson(WORK_KEY, all, all[i].facilityId);
}

/** Rebuild open work items from live AR signals (idempotent by title+patient) */
export function refreshWorkItemsFromLiveData(facilityId: string): ArWorkItem[] {
  const snap = computeArSnapshot(facilityId);
  const existing = listWorkItems(facilityId, 'open');
  const keep = existing.filter((w) => w.type === 'statement' || w.type === 'missing_auth');
  const generated: ArWorkItem[] = [];

  for (const d of snap.debtors.filter((x) => x.daysOutstanding >= 30).slice(0, 40)) {
    generated.push({
      id: `WRK-AGE-${d.patientId}`,
      facilityId,
      type: 'aged_debtor',
      title: `Aged debtor · ${d.patientName}`,
      detail: `${d.daysOutstanding}d · ₦${d.balanceNgn.toLocaleString()} · ${d.payerHint}`,
      patientId: d.patientId,
      hospitalNumber: d.hospitalNumber,
      amountNgn: d.balanceNgn,
      status: 'open',
      priority: d.daysOutstanding >= 90 ? 'critical' : d.daysOutstanding >= 60 ? 'high' : 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  for (const c of listClaims(facilityId).filter((x) => x.status === 'denied').slice(0, 20)) {
    generated.push({
      id: `WRK-DEN-${c.id}`,
      facilityId,
      type: 'denied_claim',
      title: `Denied claim · ${c.patientName}`,
      detail: c.denialReason || `${c.payerName} · ₦${c.amountNgn.toLocaleString()}`,
      patientId: c.patientId,
      hospitalNumber: c.hospitalNumber,
      amountNgn: c.amountNgn,
      status: 'open',
      priority: 'high',
      createdAt: c.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  for (const c of listClaims(facilityId).filter((x) => x.status === 'preauth_pending').slice(0, 20)) {
    generated.push({
      id: `WRK-AUTH-${c.id}`,
      facilityId,
      type: 'missing_auth',
      title: `Pre-auth pending · ${c.patientName}`,
      detail: `${c.payerName} · ₦${c.amountNgn.toLocaleString()}`,
      patientId: c.patientId,
      hospitalNumber: c.hospitalNumber,
      amountNgn: c.amountNgn,
      status: 'open',
      priority: 'medium',
      createdAt: c.createdAt,
      updatedAt: new Date().toISOString(),
    });
  }

  for (const r of listAccountsRequests(facilityId, { status: 'awaiting_payment' }).slice(0, 30)) {
    generated.push({
      id: `WRK-FD-${r.id}`,
      facilityId,
      type: 'fd_awaiting',
      title: `Front desk invoice · ${r.patientName}`,
      detail: `${r.purpose} · ₦${r.amountNgn.toLocaleString()}`,
      patientId: r.patientId,
      hospitalNumber: r.hospitalNumber,
      amountNgn: r.amountNgn,
      status: 'open',
      priority: 'high',
      createdAt: r.sentAt,
      updatedAt: new Date().toISOString(),
    });
  }

  for (const d of snap.debtors.filter((x) => x.partial).slice(0, 15)) {
    generated.push({
      id: `WRK-PART-${d.patientId}`,
      facilityId,
      type: 'partial_pay',
      title: `Partial payment · ${d.patientName}`,
      detail: `Balance ₦${d.balanceNgn.toLocaleString()}`,
      patientId: d.patientId,
      hospitalNumber: d.hospitalNumber,
      amountNgn: d.balanceNgn,
      status: 'open',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // HMO leakage heuristic: high HMO AR with few submitted claims
  if (snap.hmoArNgn > 50000 && snap.openClaims < 3) {
    generated.push({
      id: `WRK-LEAK-${facilityId}`,
      facilityId,
      type: 'hmo_leakage',
      title: 'Possible HMO leakage',
      detail: `HMO AR ₦${snap.hmoArNgn.toLocaleString()} with only ${snap.openClaims} open claims — submit or reclassify`,
      amountNgn: snap.hmoArNgn,
      status: 'open',
      priority: 'critical',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const byId = new Map<string, ArWorkItem>();
  for (const w of [...keep, ...generated]) byId.set(w.id, w);
  // preserve done/dismissed
  for (const w of readJson<ArWorkItem>(WORK_KEY).filter((x) => x.facilityId === facilityId)) {
    if (w.status === 'done' || w.status === 'dismissed' || w.status === 'in_progress') {
      byId.set(w.id, w);
    }
  }
  const next = Array.from(byId.values());
  writeJson(WORK_KEY, next, facilityId);
  return next.filter((w) => w.status === 'open' || w.status === 'in_progress');
}

export function computeArSnapshot(facilityId: string): ArDashboardSnapshot {
  const lines = listBillLines(facilityId).filter(
    (l) => l.status === 'unpaid' || l.status === 'partial' || l.status === 'hmo'
  );
  const fd = listAccountsRequests(facilityId);
  const payments = todayPayments(facilityId).filter((p) => p.status === 'success');
  const claims = listClaims(facilityId);

  const debtMap = new Map<string, DebtorRow>();
  for (const l of lines) {
    if (l.status === 'hmo' && l.amountNgn <= 0) continue;
    const key = l.patientId || l.hospitalNumber;
    const payer = inferPayer(l, fd);
    const days = daysBetween(l.createdAt);
    const prev = debtMap.get(key);
    if (!prev) {
      debtMap.set(key, {
        patientId: l.patientId,
        hospitalNumber: l.hospitalNumber,
        patientName: l.patientName,
        payerHint: payer,
        balanceNgn: l.status === 'hmo' ? 0 : l.amountNgn, // HMO still tracked in hmo bucket via lines
        oldestOpenAt: l.createdAt,
        daysOutstanding: days,
        lineCount: 1,
        partial: l.status === 'partial',
        sources: [l.source],
      });
      // For pure HMO status lines count as AR under hmo via separate path
      if (l.status === 'hmo') {
        debtMap.get(key)!.balanceNgn = l.amountNgn;
        debtMap.get(key)!.payerHint = 'hmo';
      }
    } else {
      prev.balanceNgn += l.amountNgn;
      prev.lineCount += 1;
      prev.partial = prev.partial || l.status === 'partial';
      if (l.createdAt < prev.oldestOpenAt) {
        prev.oldestOpenAt = l.createdAt;
        prev.daysOutstanding = days;
      }
      if (!prev.sources.includes(l.source)) prev.sources.push(l.source);
    }
  }

  // Include FD awaiting not yet on bill lines
  for (const r of fd.filter((x) => x.status === 'awaiting_payment')) {
    const key = r.patientId || r.hospitalNumber;
    if (!debtMap.has(key)) {
      debtMap.set(key, {
        patientId: r.patientId,
        hospitalNumber: r.hospitalNumber,
        patientName: r.patientName,
        payerHint: 'cash',
        balanceNgn: r.amountNgn,
        oldestOpenAt: r.sentAt,
        daysOutstanding: daysBetween(r.sentAt),
        lineCount: 1,
        partial: false,
        sources: ['front_desk'],
      });
    }
  }

  const debtors = Array.from(debtMap.values())
    .filter((d) => d.balanceNgn > 0)
    .sort((a, b) => b.balanceNgn - a.balanceNgn);

  const aging: AgingBuckets = {
    d0_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90plus: 0,
    byPayer: emptyPayerBuckets(),
  };

  const addAge = (payer: PayerType, days: number, amt: number) => {
    const b = aging.byPayer[payer];
    b.total += amt;
    if (days <= 30) {
      aging.d0_30 += amt;
      b.d0_30 += amt;
    } else if (days <= 60) {
      aging.d31_60 += amt;
      b.d31_60 += amt;
    } else if (days <= 90) {
      aging.d61_90 += amt;
      b.d61_90 += amt;
    } else {
      aging.d90plus += amt;
      b.d90plus += amt;
    }
  };

  for (const l of lines) {
    if (l.status === 'paid' || l.status === 'waived') continue;
    const payer = inferPayer(l, fd);
    addAge(payer, daysBetween(l.createdAt), l.amountNgn);
  }
  for (const r of fd.filter((x) => x.status === 'awaiting_payment')) {
    // avoid double-count if already a bill line for same invoice
    const hasLine = lines.some(
      (l) => l.orderId === r.billOrderId || l.description.includes(r.invoiceNumber || '___')
    );
    if (!hasLine) addAge('cash', daysBetween(r.sentAt), r.amountNgn);
  }

  const cashAr = aging.byPayer.cash.total + aging.byPayer.family.total;
  const hmoAr = aging.byPayer.hmo.total;
  const nhiaAr = aging.byPayer.nhia.total;
  const corpAr = aging.byPayer.corporate.total;
  const totalAr = cashAr + hmoAr + nhiaAr + corpAr;

  const collectedToday = payments.reduce((s, p) => s + p.amount, 0);
  const cashToday = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + p.amount, 0);
  const posToday = payments.filter((p) => p.method === 'pos').reduce((s, p) => s + p.amount, 0);
  const transferToday = payments
    .filter((p) => p.method === 'transfer' || p.method === 'card')
    .reduce((s, p) => s + p.amount, 0);

  const fdAwait = fd.filter((x) => x.status === 'awaiting_payment');
  const openClaims = claims.filter((c) =>
    ['draft', 'preauth_pending', 'preauth_approved', 'submitted', 'queried', 'appealed'].includes(c.status)
  ).length;
  const deniedClaims = claims.filter((c) => c.status === 'denied').length;
  const preauthPending = claims.filter((c) => c.status === 'preauth_pending').length;

  // Simple collection rate: collected today / (collected + remaining AR) * 100 capped
  const denom = collectedToday + totalAr;
  const collectionRatePct = denom <= 0 ? 100 : Math.min(100, Math.round((collectedToday / denom) * 1000) / 10);

  const topDebtor = debtors[0];
  const aiBrief =
    totalAr <= 0
      ? 'AR clear — no open patient balances. Keep posting front-desk invoices and close the shift at end of day.'
      : `AR ₦${totalAr.toLocaleString()} · Cash ₦${cashAr.toLocaleString()} · HMO/NHIA ₦${(hmoAr + nhiaAr).toLocaleString()}. ` +
        `${fdAwait.length} front-desk invoices awaiting collection. ` +
        (topDebtor
          ? `Largest debtor: ${topDebtor.patientName} ₦${topDebtor.balanceNgn.toLocaleString()} (${topDebtor.daysOutstanding}d). `
          : '') +
        (deniedClaims ? `${deniedClaims} denied claims need appeal. ` : '') +
        (aging.d90plus > 0 ? `₦${aging.d90plus.toLocaleString()} is 90+ days — prioritise follow-up.` : 'Aging within control.');

  return {
    facilityId,
    totalArNgn: totalAr,
    cashArNgn: cashAr,
    hmoArNgn: hmoAr,
    nhiaArNgn: nhiaAr,
    corporateArNgn: corpAr,
    collectedTodayNgn: collectedToday,
    cashTodayNgn: cashToday,
    posTodayNgn: posToday,
    transferTodayNgn: transferToday,
    receiptCountToday: payments.length,
    fdAwaitingCount: fdAwait.length,
    fdAwaitingNgn: fdAwait.reduce((s, r) => s + r.amountNgn, 0),
    openClaims,
    deniedClaims,
    preauthPending,
    collectionRatePct,
    aging,
    debtors,
    workItems: listWorkItems(facilityId).filter((w) => w.status === 'open' || w.status === 'in_progress'),
    aiBrief,
    updatedAt: new Date().toISOString(),
  };
}

export function expectedCashFromPayments(facilityId: string): number {
  return todayPayments(facilityId)
    .filter((p) => p.status === 'success' && p.method === 'cash')
    .reduce((s, p) => s + p.amount, 0);
}

export function subscribeArDesk(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(AR_EVT, fn);
  window.addEventListener('storage', fn);
  window.addEventListener('medcore-admin-sync', fn);
  const u1 = subscribeBills(fn);
  const u2 = subscribeAccountsRequests(fn);
  window.addEventListener('medcore-reception-ops', fn);
  return () => {
    window.removeEventListener(AR_EVT, fn);
    window.removeEventListener('storage', fn);
    window.removeEventListener('medcore-admin-sync', fn);
    window.removeEventListener('medcore-reception-ops', fn);
    u1();
    u2();
  };
}

export async function arAiCoach(facilityId: string): Promise<string> {
  const snap = computeArSnapshot(facilityId);
  const local = snap.aiBrief;
  try {
    const { geminiGenerate, hasGeminiKey } = await import('./geminiClient');
    if (!hasGeminiKey()) return local;
    const res = await geminiGenerate(
      `Hospital AR snapshot (Nigeria Naira):\n${JSON.stringify({
        totalAr: snap.totalArNgn,
        cashAr: snap.cashArNgn,
        hmoAr: snap.hmoArNgn,
        nhiaAr: snap.nhiaArNgn,
        collectedToday: snap.collectedTodayNgn,
        fdAwaiting: snap.fdAwaitingCount,
        openClaims: snap.openClaims,
        denied: snap.deniedClaims,
        aging90: snap.aging.d90plus,
        topDebtors: snap.debtors.slice(0, 5).map((d) => ({
          name: d.patientName,
          bal: d.balanceNgn,
          days: d.daysOutstanding,
          payer: d.payerHint,
        })),
      })}\nGive 4 bullet operational actions for the cashier/accountant today. Be concise.`,
      'You are MedCore AR copilot for Nigerian hospitals. Focus on cash collection, HMO leakage, NHIA claims, shift discipline.'
    );
    if (res.ok && res.text) return res.text;
  } catch {
    /* fall through */
  }
  return local;
}
