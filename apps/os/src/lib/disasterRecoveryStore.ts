/**
 * Backup, replication status, and DR runbook for facility operations.
 */
import { publishFacilityData } from './roleSyncBus';
import { getAdminSettings } from './adminSettingsStore';

export const DR_KEY = 'medcore_os_dr_status_v1';
export const DR_EVT = 'medcore-dr-status';

export type DrSnapshot = {
  id: string;
  facilityId: string;
  createdAt: string;
  kind: 'manual' | 'scheduled' | 'pre_failover';
  sizeEstimate: number;
  keys: string[];
  note?: string;
};

export type DrStatus = {
  facilityId: string;
  lastBackupAt?: string;
  lastCloudSyncAt?: string;
  replicationHealthy: boolean;
  lanHubConfigured: boolean;
  snapshots: DrSnapshot[];
  runbookStep?: string;
};

function read(facilityId: string): DrStatus {
  if (typeof window === 'undefined') {
    return { facilityId, replicationHealthy: true, lanHubConfigured: false, snapshots: [] };
  }
  try {
    const raw = localStorage.getItem(`${DR_KEY}:${facilityId}`);
    if (raw) return JSON.parse(raw) as DrStatus;
  } catch {
    /* ignore */
  }
  return { facilityId, replicationHealthy: true, lanHubConfigured: false, snapshots: [] };
}

function write(status: DrStatus) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${DR_KEY}:${status.facilityId}`, JSON.stringify(status));
  try {
    publishFacilityData(status.facilityId, DR_KEY, status);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(DR_EVT, { detail: { facilityId: status.facilityId } }));
}

export function getDrStatus(facilityId: string): DrStatus {
  const s = read(facilityId);
  try {
    const settings = getAdminSettings(facilityId);
    s.lanHubConfigured = Boolean(settings.lanApiUrl?.trim());
  } catch {
    /* ignore */
  }
  s.replicationHealthy = typeof navigator === 'undefined' || navigator.onLine;
  return s;
}

export function createBackupSnapshot(facilityId: string, note?: string): DrSnapshot {
  const keys: string[] = [];
  let size = 0;
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.includes('medcore')) continue;
      if (k.includes(facilityId) || k.startsWith('medcore_os_') || k.startsWith('medcore_')) {
        keys.push(k);
        size += (localStorage.getItem(k) || '').length;
      }
    }
  }
  const snap: DrSnapshot = {
    id: `SNAP-${Date.now().toString(36).toUpperCase()}`,
    facilityId,
    createdAt: new Date().toISOString(),
    kind: 'manual',
    sizeEstimate: size,
    keys: keys.slice(0, 200),
    note,
  };
  const status = getDrStatus(facilityId);
  status.snapshots = [snap, ...status.snapshots].slice(0, 30);
  status.lastBackupAt = snap.createdAt;
  status.lastCloudSyncAt = new Date().toISOString();
  write(status);

  // Downloadable JSON for offline vault
  if (typeof window !== 'undefined') {
    try {
      const payload: Record<string, string> = {};
      for (const k of snap.keys) {
        payload[k] = localStorage.getItem(k) || '';
      }
      const blob = new Blob([JSON.stringify({ meta: snap, payload }, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `medcore-backup-${facilityId}-${snap.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  return snap;
}

export function setRunbookStep(facilityId: string, step: string) {
  const s = getDrStatus(facilityId);
  s.runbookStep = step;
  write(s);
}

export const DR_RUNBOOK = [
  { id: '1', title: 'Confirm outage scope', body: 'ISP only vs power vs cloud. Prefer onsite hub if LAN is up.' },
  { id: '2', title: 'Freeze non-critical writes', body: 'Pause analytics exports; keep reception, orders, vitals.' },
  { id: '3', title: 'Promote onsite hub', body: 'Point LAN hub URL in Admin Settings; verify HUB pill is green.' },
  { id: '4', title: 'Take manual snapshot', body: 'Run Create backup — store offline vault copy on encrypted drive.' },
  { id: '5', title: 'Validate integrity', body: 'Spot-check 5 patients, open orders, and last receipts.' },
  { id: '6', title: 'Resume cloud sync', body: 'When ISP returns, flush outbox; confirm Firestore catches up.' },
];
