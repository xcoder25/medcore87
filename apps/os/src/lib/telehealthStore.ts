/**
 * Telehealth encounters — schedule, join link, visit notes.
 * WebRTC room is external (Meet/Jitsi URL); chart stays in MedCore.
 */
import { publishFacilityData } from './roleSyncBus';

export const TELE_KEY = 'medcore_os_telehealth_v1';
export const TELE_EVT = 'medcore-telehealth';

export type TeleVisit = {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber?: string;
  clinicianBadge: string;
  clinicianName: string;
  scheduledAt: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  joinUrl: string;
  reason: string;
  notes?: string;
  createdAt: string;
};

function read(facilityId: string): TeleVisit[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${TELE_KEY}:${facilityId}`);
    return raw ? (JSON.parse(raw) as TeleVisit[]) : [];
  } catch {
    return [];
  }
}

function write(facilityId: string, rows: TeleVisit[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${TELE_KEY}:${facilityId}`, JSON.stringify(rows));
  try {
    publishFacilityData(facilityId, TELE_KEY, rows);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(TELE_EVT, { detail: { facilityId } }));
}

export function listTeleVisits(facilityId: string): TeleVisit[] {
  return read(facilityId).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
}

export function scheduleTeleVisit(input: Omit<TeleVisit, 'id' | 'createdAt' | 'status' | 'joinUrl'> & { joinUrl?: string }): TeleVisit {
  const rows = read(input.facilityId);
  const id = `TV-${Date.now().toString(36).toUpperCase()}`;
  const joinUrl =
    input.joinUrl ||
    `https://meet.jit.si/medcore-${input.facilityId}-${id}`.replace(/\s/g, '');
  const row: TeleVisit = {
    ...input,
    id,
    status: 'scheduled',
    joinUrl,
    createdAt: new Date().toISOString(),
  };
  rows.unshift(row);
  write(input.facilityId, rows);
  return row;
}

export function updateTeleVisit(
  facilityId: string,
  id: string,
  patch: Partial<Pick<TeleVisit, 'status' | 'notes' | 'joinUrl'>>
) {
  const rows = read(facilityId).map((r) => (r.id === id ? { ...r, ...patch } : r));
  write(facilityId, rows);
}

export function subscribeTelehealth(facilityId: string, cb: () => void): () => void {
  const h = () => cb();
  window.addEventListener(TELE_EVT, h);
  return () => window.removeEventListener(TELE_EVT, h);
}
