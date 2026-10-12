/**
 * Health Information Management (HIM) — Epic/Cerner-style workqueues.
 * Facility-scoped, realtime via localStorage + BroadcastChannel + Firestore publish.
 */
'use client';

import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';

export const HIM_STORAGE_KEY = 'medcore_os_him_v1';

export type HimDeficiencyStatus = 'open' | 'in_progress' | 'resolved' | 'waived';
export type HimDeficiencyType =
  | 'unsigned_note'
  | 'missing_discharge_summary'
  | 'incomplete_demographics'
  | 'missing_consent'
  | 'missing_op_report'
  | 'other';

export type HimCodingStatus = 'pending' | 'in_progress' | 'coded' | 'queried' | 'final';
export type HimRoiStatus =
  | 'requested'
  | 'auth_pending'
  | 'approved'
  | 'disclosed'
  | 'denied'
  | 'cancelled';
export type HimChartCompleteStatus = 'incomplete' | 'him_review' | 'complete' | 'bill_hold';
export type HimMergeStatus = 'proposed' | 'approved' | 'merged' | 'rejected';
export type HimDocType =
  | 'external_scan'
  | 'referral_letter'
  | 'consent'
  | 'lab_paper'
  | 'imaging_cd'
  | 'other';

export interface HimDeficiency {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  encounterId?: string;
  type: HimDeficiencyType;
  detail: string;
  status: HimDeficiencyStatus;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface HimCodingCase {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  encounterId?: string;
  status: HimCodingStatus;
  principalDiagnosis?: string;
  secondaryDiagnoses: string[];
  procedures: string[];
  drgHint?: string;
  coderNotes?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HimRoiRequest {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  requestor: string;
  requestorOrg?: string;
  purpose: string;
  status: HimRoiStatus;
  documentsRequested: string;
  authOnFile: boolean;
  disclosedAt?: string;
  disclosedBy?: string;
  denialReason?: string;
  createdAt: string;
  updatedAt: string;
  auditTrail: { at: string; by: string; action: string }[];
}

export interface HimChartGate {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  encounterId?: string;
  status: HimChartCompleteStatus;
  notes?: string;
  markedCompleteBy?: string;
  markedCompleteAt?: string;
  billHoldReason?: string;
  updatedAt: string;
  createdAt: string;
}

export interface HimMpiMerge {
  id: string;
  facilityId: string;
  survivorId: string;
  survivorName: string;
  survivorHn?: string;
  duplicateId: string;
  duplicateName: string;
  duplicateHn?: string;
  status: HimMergeStatus;
  reason: string;
  proposedBy?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HimDocument {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  encounterId?: string;
  docType: HimDocType;
  title: string;
  indexedBy?: string;
  notes?: string;
  createdAt: string;
}

export interface HimState {
  deficiencies: HimDeficiency[];
  coding: HimCodingCase[];
  roi: HimRoiRequest[];
  charts: HimChartGate[];
  merges: HimMpiMerge[];
  documents: HimDocument[];
}

const EMPTY: HimState = {
  deficiencies: [],
  coding: [],
  roi: [],
  charts: [],
  merges: [],
  documents: [],
};

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readRaw(): HimState {
  if (typeof window === 'undefined') return { ...EMPTY };
  try {
    const raw = localStorage.getItem(HIM_STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw);
    return {
      deficiencies: Array.isArray(p.deficiencies) ? p.deficiencies : [],
      coding: Array.isArray(p.coding) ? p.coding : [],
      roi: Array.isArray(p.roi) ? p.roi : [],
      charts: Array.isArray(p.charts) ? p.charts : [],
      merges: Array.isArray(p.merges) ? p.merges : [],
      documents: Array.isArray(p.documents) ? p.documents : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function writeRaw(state: HimState, facilityId?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HIM_STORAGE_KEY, JSON.stringify(state));
  try {
    window.dispatchEvent(new CustomEvent('medcore-him-updated', { detail: state }));
    window.dispatchEvent(new StorageEvent('storage', { key: HIM_STORAGE_KEY }));
  } catch {
    /* ignore */
  }
  const fid = facilityId || inferFacility(state);
  if (fid) {
    try {
      publishFacilityData(fid, HIM_STORAGE_KEY, state);
      // also under FACILITY_KEYS alias if present
      if ((FACILITY_KEYS as Record<string, string>).him) {
        publishFacilityData(fid, (FACILITY_KEYS as Record<string, string>).him, state);
      }
    } catch {
      /* ignore */
    }
  }
}

function inferFacility(state: HimState): string {
  const sample =
    state.deficiencies[0] ||
    state.coding[0] ||
    state.roi[0] ||
    state.charts[0] ||
    state.merges[0] ||
    state.documents[0];
  return sample?.facilityId || '';
}

export function getHimState(): HimState {
  return readRaw();
}

export function subscribeHim(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener('medcore-him-updated', fn);
  window.addEventListener('storage', (e) => {
    if (e.key === HIM_STORAGE_KEY || !e.key) fn();
  });
  return () => {
    window.removeEventListener('medcore-him-updated', fn);
  };
}

/** Apply remote HIM payload from facility sync */
export function applyHimRemote(payload: unknown) {
  if (!payload || typeof payload !== 'object') return;
  const p = payload as Partial<HimState>;
  const next: HimState = {
    deficiencies: Array.isArray(p.deficiencies) ? p.deficiencies : readRaw().deficiencies,
    coding: Array.isArray(p.coding) ? p.coding : readRaw().coding,
    roi: Array.isArray(p.roi) ? p.roi : readRaw().roi,
    charts: Array.isArray(p.charts) ? p.charts : readRaw().charts,
    merges: Array.isArray(p.merges) ? p.merges : readRaw().merges,
    documents: Array.isArray(p.documents) ? p.documents : readRaw().documents,
  };
  if (typeof window === 'undefined') return;
  localStorage.setItem(HIM_STORAGE_KEY, JSON.stringify(next));
  try {
    window.dispatchEvent(new CustomEvent('medcore-him-updated', { detail: next }));
  } catch {
    /* ignore */
  }
}

function filterFacility<T extends { facilityId: string }>(rows: T[], facilityId: string): T[] {
  const f = (facilityId || '').toUpperCase();
  if (!f) return rows;
  return rows.filter((r) => String(r.facilityId || '').toUpperCase() === f);
}

export function listDeficiencies(facilityId: string, status?: HimDeficiencyStatus) {
  let rows = filterFacility(readRaw().deficiencies, facilityId);
  if (status) rows = rows.filter((r) => r.status === status);
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function addDeficiency(
  input: Omit<HimDeficiency, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: HimDeficiencyStatus;
  }
): HimDeficiency {
  const now = new Date().toISOString();
  const row: HimDeficiency = {
    ...input,
    id: uid('def'),
    status: input.status || 'open',
    createdAt: now,
    updatedAt: now,
  };
  const state = readRaw();
  state.deficiencies = [row, ...state.deficiencies];
  writeRaw(state, input.facilityId);
  return row;
}

export function updateDeficiency(
  id: string,
  patch: Partial<HimDeficiency>,
  facilityId?: string
): HimDeficiency | null {
  const state = readRaw();
  const i = state.deficiencies.findIndex((d) => d.id === id);
  if (i < 0) return null;
  const next = {
    ...state.deficiencies[i],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  state.deficiencies[i] = next;
  writeRaw(state, facilityId || next.facilityId);
  return next;
}

export function listCoding(facilityId: string, status?: HimCodingStatus) {
  let rows = filterFacility(readRaw().coding, facilityId);
  if (status) rows = rows.filter((r) => r.status === status);
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function addCodingCase(
  input: Omit<HimCodingCase, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'secondaryDiagnoses' | 'procedures'> & {
    status?: HimCodingStatus;
    secondaryDiagnoses?: string[];
    procedures?: string[];
  }
): HimCodingCase {
  const now = new Date().toISOString();
  const row: HimCodingCase = {
    ...input,
    id: uid('cod'),
    secondaryDiagnoses: input.secondaryDiagnoses || [],
    procedures: input.procedures || [],
    status: input.status || 'pending',
    createdAt: now,
    updatedAt: now,
  };
  const state = readRaw();
  state.coding = [row, ...state.coding];
  writeRaw(state, input.facilityId);
  return row;
}

export function updateCoding(
  id: string,
  patch: Partial<HimCodingCase>,
  facilityId?: string
): HimCodingCase | null {
  const state = readRaw();
  const i = state.coding.findIndex((d) => d.id === id);
  if (i < 0) return null;
  const next = { ...state.coding[i], ...patch, updatedAt: new Date().toISOString() };
  state.coding[i] = next;
  writeRaw(state, facilityId || next.facilityId);
  return next;
}

export function listRoi(facilityId: string) {
  return filterFacility(readRaw().roi, facilityId).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export function addRoiRequest(
  input: Omit<HimRoiRequest, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'auditTrail' | 'authOnFile'> & {
    status?: HimRoiStatus;
    authOnFile?: boolean;
  }
): HimRoiRequest {
  const now = new Date().toISOString();
  const row: HimRoiRequest = {
    ...input,
    id: uid('roi'),
    status: input.status || 'requested',
    authOnFile: input.authOnFile ?? false,
    auditTrail: [{ at: now, by: input.requestor, action: 'Request created' }],
    createdAt: now,
    updatedAt: now,
  };
  const state = readRaw();
  state.roi = [row, ...state.roi];
  writeRaw(state, input.facilityId);
  return row;
}

export function updateRoi(
  id: string,
  patch: Partial<HimRoiRequest>,
  actor: string,
  action: string,
  facilityId?: string
): HimRoiRequest | null {
  const state = readRaw();
  const i = state.roi.findIndex((d) => d.id === id);
  if (i < 0) return null;
  const now = new Date().toISOString();
  const prev = state.roi[i];
  const next: HimRoiRequest = {
    ...prev,
    ...patch,
    updatedAt: now,
    auditTrail: [...(prev.auditTrail || []), { at: now, by: actor, action }],
  };
  state.roi[i] = next;
  writeRaw(state, facilityId || next.facilityId);
  return next;
}

export function listChartGates(facilityId: string) {
  return filterFacility(readRaw().charts, facilityId).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export function upsertChartGate(
  input: Omit<HimChartGate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): HimChartGate {
  const state = readRaw();
  const now = new Date().toISOString();
  if (input.id) {
    const i = state.charts.findIndex((c) => c.id === input.id);
    if (i >= 0) {
      const next = { ...state.charts[i], ...input, updatedAt: now };
      state.charts[i] = next;
      writeRaw(state, input.facilityId);
      return next;
    }
  }
  const row: HimChartGate = {
    ...input,
    id: input.id || uid('cht'),
    createdAt: now,
    updatedAt: now,
  };
  state.charts = [row, ...state.charts];
  writeRaw(state, input.facilityId);
  return row;
}

export function listMerges(facilityId: string) {
  return filterFacility(readRaw().merges, facilityId).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export function proposeMpiMerge(
  input: Omit<HimMpiMerge, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: HimMergeStatus;
  }
): HimMpiMerge {
  const now = new Date().toISOString();
  const row: HimMpiMerge = {
    ...input,
    id: uid('mrg'),
    status: input.status || 'proposed',
    createdAt: now,
    updatedAt: now,
  };
  const state = readRaw();
  state.merges = [row, ...state.merges];
  writeRaw(state, input.facilityId);
  return row;
}

export function updateMerge(
  id: string,
  patch: Partial<HimMpiMerge>,
  facilityId?: string
): HimMpiMerge | null {
  const state = readRaw();
  const i = state.merges.findIndex((d) => d.id === id);
  if (i < 0) return null;
  const next = { ...state.merges[i], ...patch, updatedAt: new Date().toISOString() };
  state.merges[i] = next;
  writeRaw(state, facilityId || next.facilityId);
  return next;
}

export function listDocuments(facilityId: string, patientId?: string) {
  let rows = filterFacility(readRaw().documents, facilityId);
  if (patientId) rows = rows.filter((d) => d.patientId === patientId);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function indexDocument(
  input: Omit<HimDocument, 'id' | 'createdAt'>
): HimDocument {
  const row: HimDocument = {
    ...input,
    id: uid('doc'),
    createdAt: new Date().toISOString(),
  };
  const state = readRaw();
  state.documents = [row, ...state.documents];
  writeRaw(state, input.facilityId);
  return row;
}

export function himSummary(facilityId: string) {
  const defOpen = listDeficiencies(facilityId).filter(
    (d) => d.status === 'open' || d.status === 'in_progress'
  ).length;
  const codePending = listCoding(facilityId).filter(
    (c) => c.status === 'pending' || c.status === 'in_progress' || c.status === 'queried'
  ).length;
  const roiOpen = listRoi(facilityId).filter(
    (r) => !['disclosed', 'denied', 'cancelled'].includes(r.status)
  ).length;
  const chartHold = listChartGates(facilityId).filter(
    (c) => c.status === 'incomplete' || c.status === 'him_review' || c.status === 'bill_hold'
  ).length;
  const mergeOpen = listMerges(facilityId).filter(
    (m) => m.status === 'proposed' || m.status === 'approved'
  ).length;
  const docs = listDocuments(facilityId).length;
  return { defOpen, codePending, roiOpen, chartHold, mergeOpen, docs };
}
