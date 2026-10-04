/**
 * Hospital-wide queue engine — reception, OPD, lab, pharmacy, radiology, theatre.
 */
import { publishFacilityData } from './roleSyncBus';

export type QueueDept =
  | 'reception'
  | 'opd'
  | 'emergency'
  | 'lab'
  | 'pharmacy'
  | 'radiology'
  | 'theatre'
  | 'specialist';

export type QueueTicketStatus =
  | 'waiting'
  | 'called'
  | 'serving'
  | 'completed'
  | 'no_show'
  | 'cancelled';

export type QueuePriority = 'routine' | 'urgent' | 'stat' | 'vip';

export interface QueueTicket {
  id: string;
  facilityId: string;
  department: QueueDept;
  token: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  priority: QueuePriority;
  status: QueueTicketStatus;
  service?: string;
  provider?: string;
  linkedOrderId?: string;
  linkedVisitId?: string;
  arrivedAt: string;
  calledAt?: string;
  completedAt?: string;
  etaMinutes?: number;
}

const KEY = 'medcore_os_universal_queue_v1';
const EVT = 'medcore-universal-queue';

function read(): QueueTicket[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(list: QueueTicket[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 4000)));
  window.dispatchEvent(new CustomEvent(EVT, { detail: list }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: KEY } }));
  publishFacilityData(list[0]?.facilityId || 'IGH-EKT', KEY, list);
}

function nextToken(facilityId: string, department: QueueDept): string {
  const prefix: Record<QueueDept, string> = {
    reception: 'R',
    opd: 'O',
    emergency: 'E',
    lab: 'L',
    pharmacy: 'P',
    radiology: 'X',
    theatre: 'T',
    specialist: 'S',
  };
  const today = new Date().toISOString().slice(0, 10);
  const count =
    read().filter(
      (t) => t.facilityId === facilityId && t.department === department && t.arrivedAt.startsWith(today)
    ).length + 1;
  return `${prefix[department]}${String(count).padStart(3, '0')}`;
}

export function listQueue(
  facilityId: string,
  opts?: { department?: QueueDept; status?: QueueTicketStatus }
): QueueTicket[] {
  let list = read().filter((t) => t.facilityId === facilityId);
  if (opts?.department) list = list.filter((t) => t.department === opts.department);
  if (opts?.status) list = list.filter((t) => t.status === opts.status);
  const pri = { stat: 0, urgent: 1, vip: 2, routine: 3 };
  return list.sort((a, b) => {
    if (a.status !== b.status) {
      const order = ['called', 'serving', 'waiting', 'completed', 'no_show', 'cancelled'];
      return order.indexOf(a.status) - order.indexOf(b.status);
    }
    const pd = pri[a.priority] - pri[b.priority];
    if (pd !== 0) return pd;
    return a.arrivedAt.localeCompare(b.arrivedAt);
  });
}

export function enqueue(input: Omit<QueueTicket, 'id' | 'token' | 'arrivedAt' | 'status'> & { status?: QueueTicketStatus }): QueueTicket {
  const ticket: QueueTicket = {
    ...input,
    id: `QT-${Date.now().toString(36).toUpperCase()}`,
    token: nextToken(input.facilityId, input.department),
    status: input.status || 'waiting',
    arrivedAt: new Date().toISOString(),
    etaMinutes: input.etaMinutes ?? 15,
  };
  write([ticket, ...read()]);
  return ticket;
}

export function updateTicket(
  id: string,
  patch: Partial<Pick<QueueTicket, 'status' | 'provider' | 'calledAt' | 'completedAt' | 'etaMinutes'>>
): QueueTicket | undefined {
  const list = read();
  const i = list.findIndex((t) => t.id === id);
  if (i < 0) return undefined;
  const now = new Date().toISOString();
  list[i] = {
    ...list[i],
    ...patch,
    calledAt: patch.status === 'called' ? now : list[i].calledAt,
    completedAt: patch.status === 'completed' ? now : list[i].completedAt,
  };
  write(list);
  return list[i];
}

export function callNext(facilityId: string, department: QueueDept, provider?: string): QueueTicket | undefined {
  const waiting = listQueue(facilityId, { department }).filter((t) => t.status === 'waiting');
  if (!waiting[0]) return undefined;
  return updateTicket(waiting[0].id, { status: 'called', provider });
}

export function queueStats(facilityId: string, department?: QueueDept) {
  const list = listQueue(facilityId, department ? { department } : undefined);
  return {
    waiting: list.filter((t) => t.status === 'waiting').length,
    called: list.filter((t) => t.status === 'called' || t.status === 'serving').length,
    completed: list.filter((t) => t.status === 'completed').length,
  };
}

export function subscribeQueue(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = () => cb();
  window.addEventListener(EVT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener('storage', fn);
  };
}

export const QUEUE_KEY = KEY;
