/**
 * Admin realtime store — shared state across Admin shell modules.
 * Uses localStorage + storage events + CustomEvent so every open tab stays in sync
 * even when the WebSocket server is offline (hospital pilot / Vercel-only deploy).
 */

import { broadcastLocal } from './hospitalSync';
import { enqueueFacilitySync } from './durableOutbox';

/** Active facility for multi-workstation share (set from session) */
let activeFacilityId = 'DEFAULT-HOSPITAL';

export function setActiveFacilityId(id: string) {
  if (id) activeFacilityId = id;
}

export function getActiveFacilityId() {
  return activeFacilityId;
}

export const KEYS = {
  transfers: 'medcore_os_transfers',
  staff: 'medcore_os_staff_registry',
  access: 'medcore_os_access_control',
  activity: 'medcore_os_admin_activity',
  compliance: 'medcore_os_compliance_items',
  positions: 'medcore_os_open_positions',
} as const;

export type AdminActivity = {
  id: string;
  time: string;
  text: string;
  at: string;
};

export type AccessRecord = {
  id: string;
  name: string;
  role: string;
  department: string;
  clearance: number;
  status: 'active' | 'suspended' | 'pending';
  lastLogin: string;
  permissions: string[];
};

export type ComplianceItem = {
  id: string;
  title: string;
  status: 'ok' | 'expiring' | 'overdue' | 'pending_audit';
  due?: string;
};

const DEFAULT_ACCESS: AccessRecord[] = [
  {
    id: 'AKS-ADM-001',
    name: 'Hospital Administrator',
    role: 'Administrator',
    department: 'Hospital Management',
    clearance: 5,
    status: 'active',
    lastLogin: 'Never',
    permissions: ['All modules'],
  },
];

const DEFAULT_COMPLIANCE: ComplianceItem[] = [];

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  return safeParse(localStorage.getItem(key), fallback);
}

function write(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  // 1) Durable local write FIRST (survives power loss if browser profile intact)
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[MedCore] local save failed — storage full?', e);
    throw e;
  }
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key } }));
  // 2) Outbox → Firestore/LAN when online (retries after outage)
  try {
    broadcastLocal(activeFacilityId, key, value);
    enqueueFacilitySync(activeFacilityId, key, value);
  } catch {
    /* still safe locally */
  }
}

export function ensureAdminDefaults() {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(KEYS.access)) write(KEYS.access, DEFAULT_ACCESS);
  if (!localStorage.getItem(KEYS.compliance)) write(KEYS.compliance, DEFAULT_COMPLIANCE);
  if (!localStorage.getItem(KEYS.activity)) write(KEYS.activity, []);
  if (!localStorage.getItem(KEYS.positions)) write(KEYS.positions, { open: 0 });
}

export function getAccessRecords(): AccessRecord[] {
  ensureAdminDefaults();
  return read(KEYS.access, DEFAULT_ACCESS);
}

export function setAccessRecords(list: AccessRecord[]) {
  write(KEYS.access, list);
  pushActivity(`Access list updated (${list.length} accounts)`);
}

export function approveAccess(id: string) {
  const list = getAccessRecords().map((r) =>
    r.id === id ? { ...r, status: 'active' as const, lastLogin: 'Just now' } : r
  );
  write(KEYS.access, list);
  const who = list.find((r) => r.id === id);
  pushActivity(`Access approved for ${who?.name || id}`);
  return list;
}

export function suspendAccess(id: string) {
  const list = getAccessRecords().map((r) =>
    r.id === id ? { ...r, status: 'suspended' as const } : r
  );
  write(KEYS.access, list);
  const who = list.find((r) => r.id === id);
  pushActivity(`Account suspended: ${who?.name || id}`);
  return list;
}

export function reactivateAccess(id: string) {
  const list = getAccessRecords().map((r) =>
    r.id === id ? { ...r, status: 'active' as const } : r
  );
  write(KEYS.access, list);
  const who = list.find((r) => r.id === id);
  pushActivity(`Account reactivated: ${who?.name || id}`);
  return list;
}

export function getTransfers(): any[] {
  return read(KEYS.transfers, []);
}

export function getStaffRegistry(): any[] {
  return read(KEYS.staff, []);
}

export function getCompliance(): ComplianceItem[] {
  ensureAdminDefaults();
  return read(KEYS.compliance, DEFAULT_COMPLIANCE);
}

export function resolveCompliance(id: string) {
  const list = getCompliance().map((c) =>
    c.id === id ? { ...c, status: 'ok' as const } : c
  );
  write(KEYS.compliance, list);
  pushActivity(`Compliance item cleared: ${id}`);
  return list;
}

export function pushActivity(text: string) {
  const now = new Date();
  const item: AdminActivity = {
    id: `act-${Date.now()}`,
    time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    text,
    at: now.toISOString(),
  };
  const prev = read<AdminActivity[]>(KEYS.activity, []);
  write(KEYS.activity, [item, ...prev].slice(0, 40));
}

export function getActivity(): AdminActivity[] {
  ensureAdminDefaults();
  return read(KEYS.activity, []);
}

export function getOpenPositions(): number {
  ensureAdminDefaults();
  const v = read<{ open: number }>(KEYS.positions, { open: 12 });
  return v.open ?? 12;
}

export function setOpenPositions(n: number) {
  write(KEYS.positions, { open: n });
}

/** Subscribe to cross-module admin updates */
export function subscribeAdminSync(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onCustom = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key && Object.values(KEYS).includes(e.key as any)) cb();
  };
  window.addEventListener('medcore-admin-sync', onCustom as EventListener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('medcore-admin-sync', onCustom as EventListener);
    window.removeEventListener('storage', onStorage);
  };
}

export type AdminSnapshot = {
  activeStaff: number;
  openPositions: number;
  pendingTransfers: number;
  staffLoggedIn: number;
  onLeave: number;
  accessIssues: number;
  accessActive: number;
  accessPending: number;
  accessSuspended: number;
  compliancePct: number;
  complianceExpiring: number;
  complianceOverdue: number;
  compliancePending: number;
  attention: { id: string; title: string; severity: 'High' | 'Medium' | 'Low'; when: string; action: string; nav: string }[];
  activity: AdminActivity[];
  depts: { name: string; count: number; pct: number; color: string }[];
  transfers: any[];
  perms: AccessRecord[];
  updatedAt: string;
};

export function buildAdminSnapshot(): AdminSnapshot {
  ensureAdminDefaults();
  const transfers = getTransfers();
  const staff = getStaffRegistry();
  const access = getAccessRecords();
  const compliance = getCompliance();
  const activity = getActivity();
  const openPositions = getOpenPositions();

  const pendingTransfers = transfers.filter((t: any) => t.status === 'pending').length;
  const activeStaff =
    staff.length > 0
      ? staff.filter((s: any) => s.status !== 'on-leave').length
      : access.filter((a) => a.status === 'active').length;
  const onLeave = staff.filter((s: any) => s.status === 'on-leave').length;
  const staffLoggedIn = 0; // session-based in production; pilot starts at 0

  const accessPending = access.filter((a) => a.status === 'pending').length;
  const accessSuspended = access.filter((a) => a.status === 'suspended').length;
  const accessActive = access.filter((a) => a.status === 'active').length;
  const accessIssues = accessPending + accessSuspended;

  const expiring = compliance.filter((c) => c.status === 'expiring').length;
  const overdue = compliance.filter((c) => c.status === 'overdue').length;
  const pendingAudit = compliance.filter((c) => c.status === 'pending_audit').length;
  const ok = compliance.filter((c) => c.status === 'ok').length;
  const compliancePct =
    compliance.length === 0
      ? 100
      : Math.round((ok / compliance.length) * 100) || 92;

  const attention: AdminSnapshot['attention'] = [];
  if (pendingTransfers > 0) {
    attention.push({
      id: 'att-trf',
      title: `${pendingTransfers} staff transfer${pendingTransfers > 1 ? 's' : ''} awaiting approval`,
      severity: 'High',
      when: 'Live',
      action: 'Review',
      nav: 'transfer',
    });
  }
  if (accessPending > 0) {
    attention.push({
      id: 'att-acc',
      title: `${accessPending} access request${accessPending > 1 ? 's' : ''} pending`,
      severity: 'Medium',
      when: 'Live',
      action: 'Review',
      nav: 'rbac',
    });
  }
  if (expiring + overdue > 0) {
    attention.push({
      id: 'att-cmp',
      title: `${expiring + overdue} compliance document${expiring + overdue > 1 ? 's' : ''} need attention`,
      severity: overdue > 0 ? 'High' : 'Medium',
      when: 'Live',
      action: 'Review',
      nav: 'compliance',
    });
  }
  if (openPositions > 0) {
    attention.push({
      id: 'att-pos',
      title: `${openPositions} open positions need assignment`,
      severity: 'Low',
      when: 'Today',
      action: 'View',
      nav: 'enrolment',
    });
  }
  if (attention.length === 0) {
    attention.push({
      id: 'att-ok',
      title: 'No urgent admin actions — all queues clear',
      severity: 'Low',
      when: 'Live',
      action: 'Dashboard',
      nav: 'dashboard',
    });
  }

  const depts: AdminSnapshot['depts'] = [];

  return {
    activeStaff,
    openPositions,
    pendingTransfers,
    staffLoggedIn,
    onLeave,
    accessIssues,
    accessActive,
    accessPending,
    accessSuspended,
    compliancePct,
    complianceExpiring: expiring,
    complianceOverdue: overdue,
    compliancePending: pendingAudit,
    attention,
    activity: activity.length
      ? activity
      : [
          {
            id: 'seed',
            time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            text: 'Hospital OS ready — no data yet. Enrol staff to begin.',
            at: new Date().toISOString(),
          },
        ],
    depts,
    transfers: transfers.slice(0, 5),
    perms: access.slice(0, 6),
    updatedAt: new Date().toISOString(),
  };
}


/** All browser keys used by Hospital OS pilot data */
export const ALL_PILOT_KEYS = [
  KEYS.transfers,
  KEYS.staff,
  KEYS.access,
  KEYS.activity,
  KEYS.compliance,
  KEYS.positions,
  'medcore_os_session',
  'medcore_staff_id_cards',
  'medcore_os_staff_registry',
  'medcore_os_transfers',
  'ibom_os_cashier_bills',
  'ibom_os_billing_invoices',
  'medcore_os_offline_actions_v1',
  'medcore_os_patient_cache_v1',
  'medcore_os_staff_cards',
];

export const PILOT_DATA_VERSION = 'pilot-clean-v2';

/** Wipe demo data and seed a clean pilot (admin account only). */
export function resetAllPilotData(): void {
  if (typeof window === 'undefined') return;
  for (const k of ALL_PILOT_KEYS) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
  write(KEYS.access, DEFAULT_ACCESS);
  write(KEYS.compliance, []);
  write(KEYS.activity, [
    {
      id: 'boot',
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      text: 'Clean pilot started — enrol staff and create transfers to populate the OS.',
      at: new Date().toISOString(),
    },
  ]);
  write(KEYS.positions, { open: 0 });
  write(KEYS.transfers, []);
  write(KEYS.staff, []);
  try {
    localStorage.setItem('medcore_pilot_version', PILOT_DATA_VERSION);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: 'reset' } }));
}

/** Run once per browser when pilot version changes. */
export function ensureCleanPilot(): void {
  if (typeof window === 'undefined') return;
  try {
    const v = localStorage.getItem('medcore_pilot_version');
    if (v !== PILOT_DATA_VERSION) {
      resetAllPilotData();
    } else {
      ensureAdminDefaults();
    }
  } catch {
    ensureAdminDefaults();
  }
}
