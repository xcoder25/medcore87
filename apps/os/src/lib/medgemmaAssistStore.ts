/**
 * Persist MedGemma / medical AI drafts linked to clinical imaging orders.
 * Never auto-signs reports — status stays draft until human accepts.
 */
import { publishFacilityData } from './roleSyncBus';
import type { MedGemmaResult } from './medgemmaClient';

export type AssistStatus = 'draft' | 'accepted' | 'rejected' | 'superseded';

export interface ImagingAiAssist {
  id: string;
  facilityId: string;
  orderId: string;
  patientId: string;
  patientName: string;
  studyName: string;
  modality: string;
  draftText: string;
  provider: string;
  model?: string;
  disclaimer: string;
  status: AssistStatus;
  orthancUrl?: string;
  createdAt: string;
  updatedAt: string;
  actorName?: string;
  latencyMs?: number;
}

const KEY = 'medcore_os_medgemma_assist_v1';
const EVT = 'medcore-medgemma-assist';

function read(): ImagingAiAssist[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function write(list: ImagingAiAssist[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 500)));
  window.dispatchEvent(new CustomEvent(EVT, { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  const fid = list[0]?.facilityId || 'IGH-EKT';
  try {
    publishFacilityData(fid, KEY, list);
  } catch {
    /* offline */
  }
}

export function listAssists(facilityId: string, orderId?: string): ImagingAiAssist[] {
  let list = read().filter((a) => a.facilityId === facilityId);
  if (orderId) list = list.filter((a) => a.orderId === orderId);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLatestAssist(facilityId: string, orderId: string): ImagingAiAssist | undefined {
  return listAssists(facilityId, orderId)[0];
}

export function saveAssistDraft(input: {
  facilityId: string;
  orderId: string;
  patientId: string;
  patientName: string;
  studyName: string;
  modality: string;
  result: MedGemmaResult;
  orthancUrl?: string;
  actorName?: string;
}): ImagingAiAssist {
  const now = new Date().toISOString();
  // supersede previous drafts for same order
  const all = read().map((a) =>
    a.orderId === input.orderId && a.status === 'draft'
      ? { ...a, status: 'superseded' as const, updatedAt: now }
      : a
  );
  const row: ImagingAiAssist = {
    id: `MG-${Date.now().toString(36).toUpperCase()}`,
    facilityId: input.facilityId,
    orderId: input.orderId,
    patientId: input.patientId,
    patientName: input.patientName,
    studyName: input.studyName,
    modality: input.modality,
    draftText: input.result.text,
    provider: input.result.provider,
    model: input.result.model,
    disclaimer: input.result.disclaimer,
    status: 'draft',
    orthancUrl: input.orthancUrl,
    createdAt: now,
    updatedAt: now,
    actorName: input.actorName,
    latencyMs: input.result.latencyMs,
  };
  write([row, ...all]);
  return row;
}

export function setAssistStatus(id: string, status: AssistStatus): ImagingAiAssist | undefined {
  const all = read();
  const i = all.findIndex((a) => a.id === id);
  if (i < 0) return undefined;
  all[i] = { ...all[i], status, updatedAt: new Date().toISOString() };
  write(all);
  return all[i];
}

export function subscribeMedgemmaAssist(cb: () => void): () => void {
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
