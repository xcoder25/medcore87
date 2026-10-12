/**
 * Operating theatre case board — facility-scoped, multi-PC realtime.
 * Pipeline: write → localStorage + event + BroadcastChannel + publishFacilityData
 *           → Firestore / outbox → other workstations applyFacilityRemoteKey → UI subscribe
 */
import type { SurgicalCase } from '@medcore/types';
import { publishFacilityData, FACILITY_KEYS } from './roleSyncBus';

export type TheatreCaseStatus = SurgicalCase['status'];

export interface TheatreCase extends SurgicalCase {
  facilityId: string;
  patientId?: string;
  hospitalNumber?: string;
  signInDone?: boolean;
  timeOutDone?: boolean;
  signOutDone?: boolean;
  createdAt: string;
  updatedAt: string;
  scheduledBy?: string;
  scheduledByBadge?: string;
}

const KEY = FACILITY_KEYS.theatre || 'medcore_os_theatre_cases_v1';
const EVT = 'medcore-theatre-cases';
const BC_NAME = 'medcore_theatre';

function readAll(): TheatreCase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: TheatreCase[]) {
  if (typeof window === 'undefined') return;
  const next = list
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 400);
  localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  try {
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({ type: 'theatre', list: next });
    bc.close();
  } catch {
    /* ignore */
  }
  const fids = new Set(next.map((c) => c.facilityId).filter(Boolean));
  if (fids.size === 0) fids.add('IGH-EKT');
  for (const fid of fids) {
    try {
      publishFacilityData(fid, KEY, next.filter((c) => c.facilityId === fid));
    } catch {
      /* ignore */
    }
  }
}

/** Merge remote list from cloud / other PC (prefer newer updatedAt per id) */
export function applyRemoteTheatreCases(rows: unknown[]): void {
  if (typeof window === 'undefined' || !Array.isArray(rows)) return;
  const remote = rows.filter((r) => r && typeof r === 'object') as TheatreCase[];
  if (!remote.length) return;
  const byId = new Map<string, TheatreCase>();
  for (const c of readAll()) byId.set(c.id, c);
  for (const c of remote) {
    if (!c.id) continue;
    const prev = byId.get(c.id);
    if (!prev || (c.updatedAt || '') >= (prev.updatedAt || '')) {
      byId.set(c.id, { ...prev, ...c });
    }
  }
  const merged = Array.from(byId.values())
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 400);
  // Write without re-publish loop: localStorage + local events only
  localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(EVT, { detail: merged }));
}

export function listTheatreCases(facilityId: string): TheatreCase[] {
  const fid = String(facilityId || '').trim();
  return readAll()
    .filter((c) => !fid || c.facilityId === fid)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function getTheatreCase(id: string): TheatreCase | undefined {
  return readAll().find((c) => c.id === id);
}

export function upsertTheatreCase(
  partial: Omit<TheatreCase, 'createdAt' | 'updatedAt' | 'id'> & { id?: string }
): TheatreCase {
  const list = readAll();
  const now = new Date().toISOString();
  const id =
    partial.id ||
    `OR-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const idx = list.findIndex((c) => c.id === id);
  const base: TheatreCase =
    idx >= 0
      ? { ...list[idx], ...partial, id, updatedAt: now }
      : {
          id,
          facilityId: partial.facilityId,
          patientName: partial.patientName,
          theatreNumber: partial.theatreNumber,
          procedure: partial.procedure,
          leadSurgeon: partial.leadSurgeon,
          anesthetist: partial.anesthetist,
          scheduledTime: partial.scheduledTime,
          status: partial.status || 'pre_op',
          whoChecklistCompleted: !!partial.whoChecklistCompleted,
          bloodUnitsCrossmatched: partial.bloodUnitsCrossmatched || 0,
          patientId: partial.patientId,
          hospitalNumber: partial.hospitalNumber,
          signInDone: partial.signInDone,
          timeOutDone: partial.timeOutDone,
          signOutDone: partial.signOutDone,
          scheduledBy: partial.scheduledBy,
          scheduledByBadge: partial.scheduledByBadge,
          createdAt: now,
          updatedAt: now,
        };
  if (idx >= 0) list[idx] = base;
  else list.unshift(base);
  writeAll(list);
  return base;
}

export function updateTheatreCaseStatus(
  id: string,
  status: TheatreCaseStatus
): TheatreCase | undefined {
  const c = getTheatreCase(id);
  if (!c) return undefined;
  return upsertTheatreCase({ ...c, status });
}

export function toggleWhoStep(
  id: string,
  step: 'signIn' | 'timeOut' | 'signOut'
): TheatreCase | undefined {
  const c = getTheatreCase(id);
  if (!c) return undefined;
  const next = { ...c };
  if (step === 'signIn') next.signInDone = !next.signInDone;
  if (step === 'timeOut') next.timeOutDone = !next.timeOutDone;
  if (step === 'signOut') next.signOutDone = !next.signOutDone;
  next.whoChecklistCompleted = !!(next.signInDone && next.timeOutDone && next.signOutDone);
  return upsertTheatreCase(next);
}

export function theatreStats(facilityId: string) {
  const cases = listTheatreCases(facilityId);
  return {
    total: cases.length,
    preOp: cases.filter((c) => c.status === 'pre_op').length,
    inSurgery: cases.filter((c) => c.status === 'in_surgery').length,
    pacu: cases.filter((c) => c.status === 'pacu').length,
    completed: cases.filter((c) => c.status === 'completed').length,
    whoReady: cases.filter((c) => c.whoChecklistCompleted).length,
  };
}

export function subscribeTheatreCases(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('storage', fn);
  window.addEventListener('medcore-admin-sync', fn);
  window.addEventListener('medcore-facility-cloud', fn);
  let bc: BroadcastChannel | null = null;
  try {
    bc = new BroadcastChannel(BC_NAME);
    bc.onmessage = () => cb();
  } catch {
    /* ignore */
  }
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('storage', fn);
    window.removeEventListener('medcore-admin-sync', fn);
    window.removeEventListener('medcore-facility-cloud', fn);
    try {
      bc?.close();
    } catch {
      /* ignore */
    }
  };
}

export const THEATRE_KEY = KEY;
