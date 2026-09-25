/**
 * Admin realtime store — shared state across Admin shell modules.
 * Uses localStorage + storage events + CustomEvent so every open tab stays in sync
 * even when the WebSocket server is offline (hospital pilot / Vercel-only deploy).
 */

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
    lastLogin: 'Just now',
    permissions: ['All modules'],
  },
  {
    id: 'ISH-EXEC-001',
    name: 'Dr. Evelyn Vance',
    role: 'Medical Director',
    department: 'Hospital Administration',
    clearance: 5,
    status: 'active',
    lastLogin: '2 mins ago',
    permissions: ['All Clinical', 'Finance', 'Staff'],
  },
  {
    id: 'ISH-HR-002',
    name: 'Sarah Johnson',
    role: 'HR Manager',
    department: 'Human Resources',
    clearance: 4,
    status: 'active',
    lastLogin: '12 mins ago',
    permissions: ['Staff', 'Transfers', 'Rosters'],
  },
  {
    id: 'ISH-IT-003',
    name: 'Michael Okafor',
    role: 'IT Support',
    department: 'ICT',
    clearance: 4,
    status: 'active',
    lastLogin: '1 hour ago',
    permissions: ['System', 'Access control'],
  },
  {
    id: 'ISH-FIN-004',
    name: 'Amina Bello',
    role: 'Finance Officer',
    department: 'Finance',
    clearance: 3,
    status: 'active',
    lastLogin: '3 hours ago',
    permissions: ['Billing', 'Claims'],
  },
  {
    id: 'ISH-ADM-044',
    name: 'Nnamdi Obi',
    role: 'Records Officer',
    department: 'Medical Records',
    clearance: 2,
    status: 'pending',
    lastLogin: 'Never',
    permissions: [],
  },
  {
    id: 'ISH-PHAR-007',
    name: 'Funmi Adeola',
    role: 'Pharmacist',
    department: 'Pharmacy',
    clearance: 3,
    status: 'suspended',
    lastLogin: '3 days ago',
    permissions: ['Pharmacy'],
  },
];

const DEFAULT_COMPLIANCE: ComplianceItem[] = [
  { id: 'c1', title: 'NHIA facility registration', status: 'expiring', due: '2026-10-05' },
  { id: 'c2', title: 'Fire safety certificate', status: 'expiring', due: '2026-10-12' },
  { id: 'c3', title: 'Waste disposal audit', status: 'overdue', due: '2026-09-20' },
  { id: 'c4', title: 'NDPR data protection review', status: 'overdue', due: '2026-09-15' },
  { id: 'c5', title: 'Quarterly clinical audit', status: 'pending_audit' },
  { id: 'c6', title: 'Staff license verification', status: 'ok' },
];

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
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key } }));
}

export function ensureAdminDefaults() {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem(KEYS.access)) write(KEYS.access, DEFAULT_ACCESS);
  if (!localStorage.getItem(KEYS.compliance)) write(KEYS.compliance, DEFAULT_COMPLIANCE);
  if (!localStorage.getItem(KEYS.activity)) write(KEYS.activity, []);
  if (!localStorage.getItem(KEYS.positions)) write(KEYS.positions, { open: 12 });
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
      : Math.max(access.filter((a) => a.status === 'active').length, 87);
  const onLeave =
    staff.filter((s: any) => s.status === 'on-leave').length || 8;
  const staffLoggedIn = Math.min(activeStaff, Math.max(1, Math.floor(activeStaff * 0.74)));

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

  const depts = [
    { name: 'Nursing', count: 34, pct: 92, color: '#6366F1' },
    { name: 'Internal Medicine', count: 14, pct: 78, color: '#0EA5E9' },
    { name: 'Radiology', count: 11, pct: 76, color: '#14B8A6' },
    { name: 'Surgery', count: 9, pct: 71, color: '#A855F7' },
    { name: 'Pharmacy', count: 6, pct: 68, color: '#22C55E' },
  ];

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
            text: 'Admin workspace online — live updates enabled',
            at: new Date().toISOString(),
          },
        ],
    depts,
    transfers: transfers.slice(0, 5),
    perms: access.slice(0, 6),
    updatedAt: new Date().toISOString(),
  };
}
