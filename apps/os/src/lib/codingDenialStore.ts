/**
 * Billing coding + denial workqueue — ICD/CPT tracking and denial management.
 */
import { publishFacilityData } from './roleSyncBus';

export const CODING_KEY = 'medcore_os_coding_denials_v1';
export const CODING_EVT = 'medcore-coding-denials';

export type CodeEntry = {
  system: 'ICD-10' | 'ICD-11' | 'CPT' | 'HCPCS' | 'NHIA';
  code: string;
  display: string;
};

export type ClaimCodingCase = {
  id: string;
  facilityId: string;
  patientName: string;
  hospitalNumber: string;
  encounterId?: string;
  visitDate: string;
  codes: CodeEntry[];
  status: 'draft' | 'coded' | 'submitted' | 'paid' | 'denied' | 'appealed';
  payer: string;
  amountNgn: number;
  denialReason?: string;
  denialCode?: string;
  appealNotes?: string;
  updatedAt: string;
  coderBadge?: string;
};

function read(facilityId: string): ClaimCodingCase[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${CODING_KEY}:${facilityId}`);
    return raw ? (JSON.parse(raw) as ClaimCodingCase[]) : [];
  } catch {
    return [];
  }
}

function write(facilityId: string, rows: ClaimCodingCase[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${CODING_KEY}:${facilityId}`, JSON.stringify(rows));
  try {
    publishFacilityData(facilityId, CODING_KEY, rows);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CODING_EVT, { detail: { facilityId } }));
}

export function listCodingCases(facilityId: string): ClaimCodingCase[] {
  return read(facilityId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function upsertCodingCase(row: ClaimCodingCase) {
  const rows = read(row.facilityId);
  const i = rows.findIndex((r) => r.id === row.id);
  if (i >= 0) rows[i] = row;
  else rows.unshift(row);
  write(row.facilityId, rows);
}

export function markDenied(
  facilityId: string,
  id: string,
  denialCode: string,
  denialReason: string
) {
  const rows = read(facilityId).map((r) =>
    r.id === id
      ? {
          ...r,
          status: 'denied' as const,
          denialCode,
          denialReason,
          updatedAt: new Date().toISOString(),
        }
      : r
  );
  write(facilityId, rows);
}

export function markAppealed(facilityId: string, id: string, notes: string) {
  const rows = read(facilityId).map((r) =>
    r.id === id
      ? {
          ...r,
          status: 'appealed' as const,
          appealNotes: notes,
          updatedAt: new Date().toISOString(),
        }
      : r
  );
  write(facilityId, rows);
}

/** Common Nigeria-relevant sample codes for coder assist */
export const COMMON_ICD10 = [
  { code: 'J06.9', display: 'Acute upper respiratory infection' },
  { code: 'A09', display: 'Infectious gastroenteritis' },
  { code: 'O80', display: 'Single spontaneous delivery' },
  { code: 'E11.9', display: 'Type 2 diabetes mellitus' },
  { code: 'I10', display: 'Essential hypertension' },
  { code: 'Z00.0', display: 'General adult medical examination' },
];

export const COMMON_CPT_NHIA = [
  { code: 'OPD-CONS', display: 'OPD consultation' },
  { code: 'LAB-FBC', display: 'Full blood count' },
  { code: 'RAD-CXR', display: 'Chest X-ray' },
  { code: 'DEL-SVD', display: 'Spontaneous vaginal delivery' },
];
