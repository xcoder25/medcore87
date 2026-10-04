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
  roleHint?: string;
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
  publishFacilityData(list[0]?.facilityId || 'IGH-EKT', KEY, list);
}

export function pushNotification(
  input: Omit<HospitalNotification, 'id' | 'read' | 'createdAt'>
): HospitalNotification {
  // Dedupe same title within 2 minutes
  const recent = read().find(
    (n) =>
      n.facilityId === input.facilityId &&
      n.title === input.title &&
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
  return n;
}

export function listNotifications(facilityId: string, unreadOnly = false): HospitalNotification[] {
  const order: Record<NotifLevel, number> = { critical: 0, important: 1, info: 2 };
  return read()
    .filter((n) => n.facilityId === facilityId && (!unreadOnly || !n.read))
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
