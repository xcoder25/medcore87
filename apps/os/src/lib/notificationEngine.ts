/**
 * Intelligent notification engine — prioritised, non-spammy.
 */
import { publishFacilityData } from './roleSyncBus';

export type NotifLevel = 'critical' | 'important' | 'info';

export interface HospitalNotification {
  id: string;
  facilityId: string;
  level: NotifLevel;
  title: string;
  body: string;
  module?: string;
  patientId?: string;
  read: boolean;
  createdAt: string;
  /** Role key hint e.g. doctor | reception | pharmacy */
  roleHint?: string;
  /** When set, notification is primarily for this staff member (full name) */
  targetStaff?: string;
  /** Visit / queue id when related to an assignment */
  visitId?: string;
}

const KEY = 'medcore_os_notifications_v1';
const EVT = 'medcore-notifications';

function read(): HospitalNotification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(list: HospitalNotification[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 500)));
  window.dispatchEvent(new CustomEvent(EVT, { detail: list }));
  // Publish to every facilityId present in the batch (cross-facility inbox)
  const fids = new Set(
    list
      .map((n) => String(n.facilityId || '').trim())
      .filter(Boolean)
  );
  if (fids.size === 0) fids.add('IGH-EKT');
  for (const fid of fids) {
    try {
      const subset = list.filter((n) => !n.facilityId || n.facilityId === fid);
      publishFacilityData(fid, KEY, subset.length ? subset : list);
    } catch {
      /* ignore */
    }
  }
}

function mergeNotifications(local: HospitalNotification[], remote: HospitalNotification[]): HospitalNotification[] {
  const byId = new Map<string, HospitalNotification>();
  for (const n of local) byId.set(n.id, n);
  for (const n of remote) {
    const prev = byId.get(n.id);
    if (!prev || (n.createdAt || '') >= (prev.createdAt || '')) {
      byId.set(n.id, { ...prev, ...n });
    }
  }
  return Array.from(byId.values())
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 500);
}

/** Apply remote/network notification rows into local list (live, no reload) */
export function applyRemoteNotifications(rows: unknown[]): void {
  if (typeof window === 'undefined' || !Array.isArray(rows)) return;
  const remote = rows
    .filter((r) => r && typeof r === 'object')
    .map((r) => r as HospitalNotification)
    .filter((n) => n.id);
  if (!remote.length) return;
  const merged = mergeNotifications(read(), remote);
  localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent(EVT, { detail: merged }));
}

/** Start live network notification listener for this hospital */
export function startNetworkNotificationListener(facilityId: string): () => void {
  if (typeof window === 'undefined' || !facilityId) return () => {};
  let stop = () => {};
  void (async () => {
    try {
      const { firestoreSubscribeNetworkNotifications } = await import('./firebase');
      stop = firestoreSubscribeNetworkNotifications(facilityId, (rows) => {
        applyRemoteNotifications(rows);
      });
    } catch {
      /* offline */
    }
  })();
  return () => stop();
}

export function pushNotification(
  input: Omit<HospitalNotification, 'id' | 'read' | 'createdAt'>
): HospitalNotification {
  // Dedupe same title + body within 2 minutes (allow different patients)
  const recent = read().find(
    (n) =>
      n.facilityId === input.facilityId &&
      n.title === input.title &&
      n.body === input.body &&
      Date.now() - new Date(n.createdAt).getTime() < 120000
  );
  if (recent) return recent;

  const n: HospitalNotification = {
    ...input,
    id: `N-${Date.now().toString(36)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };
  write([n, ...read()]);
  // Network collection — other facilities / workstations pick up via snapshot
  void (async () => {
    try {
      const { firestoreUpsertNetworkNotification } = await import('./firebase');
      await firestoreUpsertNetworkNotification({
        ...n,
        facilityId: n.facilityId,
        toFacilityId: (input as { toFacilityId?: string }).toFacilityId,
        fromFacilityId: (input as { fromFacilityId?: string }).fromFacilityId,
      });
    } catch {
      /* offline */
    }
  })();
  return n;
}

/** Push the same notification to one or more facilities (cross-hospital transfer inbox) */
export function pushNotificationCrossFacility(
  input: Omit<HospitalNotification, 'id' | 'read' | 'createdAt'>,
  facilityIds: string[]
): HospitalNotification[] {
  const out: HospitalNotification[] = [];
  const unique = Array.from(new Set(facilityIds.map((f) => String(f || '').trim()).filter(Boolean)));
  for (const fid of unique) {
    out.push(
      pushNotification({
        ...input,
        facilityId: fid,
      })
    );
  }
  return out;
}

function normName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/^dr\.?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when notification is relevant to this staff session */
export function notificationVisibleTo(
  n: HospitalNotification,
  opts?: { staffName?: string; roleKey?: string }
): boolean {
  if (!n.targetStaff) return true;
  const me = normName(opts?.staffName || '');
  if (!me) return true;
  const target = normName(n.targetStaff);
  if (target === 'any available' || target === 'any') return true;
  return target === me || target.includes(me) || me.includes(target);
}

export function listNotifications(
  facilityId: string,
  unreadOnly = false,
  opts?: { staffName?: string; roleKey?: string }
): HospitalNotification[] {
  const order: Record<NotifLevel, number> = { critical: 0, important: 1, info: 2 };
  return read()
    .filter((n) => n.facilityId === facilityId && (!unreadOnly || !n.read))
    .filter((n) => notificationVisibleTo(n, opts))
    .sort((a, b) => order[a.level] - order[b.level] || b.createdAt.localeCompare(a.createdAt));
}

export function markRead(id: string) {
  const list = read();
  const i = list.findIndex((n) => n.id === id);
  if (i < 0) return;
  list[i] = { ...list[i], read: true };
  write(list);
}

export function markAllRead(facilityId: string) {
  write(read().map((n) => (n.facilityId === facilityId ? { ...n, read: true } : n)));
}

export function notificationSummary(facilityId: string) {
  const list = listNotifications(facilityId, true);
  return {
    critical: list.filter((n) => n.level === 'critical').length,
    important: list.filter((n) => n.level === 'important').length,
    info: list.filter((n) => n.level === 'info').length,
    total: list.length,
  };
}

export function subscribeNotifications(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}

export const NOTIF_KEY = KEY;
