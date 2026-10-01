/**
 * Reception operations — visits, queue, appointments, POS payments (local realtime)
 */
import type { FacilityPatient } from './patientRegistryStore';

export const RECEPTION_OPS_KEY = 'medcore_os_reception_ops_v2';

export type VisitType = 'appointment' | 'walkin' | 'emergency' | 'referral';
export type QueueStatus =
  | 'waiting'
  | 'called'
  | 'with_provider'
  | 'completed'
  | 'no_show'
  | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'hmo' | 'waived' | 'partial';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'pos' | 'hmo' | 'waiver';

export interface ReceptionVisit {
  id: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  facilityId: string;
  department: string;
  doctor: string;
  visitType: VisitType;
  reason?: string;
  paymentStatus: PaymentStatus;
  amount?: number;
  queueNumber: string;
  status: QueueStatus;
  checkedInAt: string;
  estimatedWaitMin?: number;
  appointmentTime?: string;
  appointmentId?: string;
  aiReminderSent?: boolean;
}

export interface ReceptionAppointment {
  id: string;
  patientId: string;
  hospitalNumber: string;
  patientName: string;
  facilityId: string;
  department: string;
  doctor: string;
  scheduledAt: string; // ISO
  reason?: string;
  status: 'booked' | 'arrived' | 'cancelled' | 'completed' | 'no_show';
  createdAt: string;
}

export interface ReceptionPayment {
  id: string;
  facilityId: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  visitId?: string;
  amount: number;
  method: PaymentMethod;
  purpose: string;
  reference: string;
  status: 'success' | 'failed' | 'pending';
  createdAt: string;
  cashier?: string;
}

export interface ReceptionDayStats {
  patientsHandled: number;
  appointments: number;
  waiting: number;
  checkIns: number;
  completed: number;
  collected: number;
  bookedToday: number;
}

type OpsState = {
  visits: ReceptionVisit[];
  queueSeq: Record<string, number>;
  appointments: ReceptionAppointment[];
  payments: ReceptionPayment[];
};

function load(): OpsState {
  if (typeof window === 'undefined') {
    return { visits: [], queueSeq: {}, appointments: [], payments: [] };
  }
  try {
    const raw = localStorage.getItem(RECEPTION_OPS_KEY);
    if (!raw) return { visits: [], queueSeq: {}, appointments: [], payments: [] };
    const p = JSON.parse(raw);
    return {
      visits: Array.isArray(p.visits) ? p.visits : [],
      queueSeq: p.queueSeq || {},
      appointments: Array.isArray(p.appointments) ? p.appointments : [],
      payments: Array.isArray(p.payments) ? p.payments : [],
    };
  } catch {
    return { visits: [], queueSeq: {}, appointments: [], payments: [] };
  }
}

function save(state: OpsState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(RECEPTION_OPS_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('medcore-reception-ops', { detail: state }));
  window.dispatchEvent(new CustomEvent('medcore-admin-sync', { detail: { key: RECEPTION_OPS_KEY } }));
}

export function listVisits(facilityId: string): ReceptionVisit[] {
  return load().visits.filter((v) => v.facilityId === facilityId);
}

export function todayVisits(facilityId: string): ReceptionVisit[] {
  const day = new Date().toISOString().slice(0, 10);
  return listVisits(facilityId).filter((v) => v.checkedInAt.slice(0, 10) === day);
}

export function dayStats(facilityId: string): ReceptionDayStats {
  const tvs = todayVisits(facilityId);
  const day = new Date().toISOString().slice(0, 10);
  const appts = load().appointments.filter(
    (a) => a.facilityId === facilityId && a.scheduledAt.slice(0, 10) === day
  );
  return {
    patientsHandled: tvs.length,
    appointments: tvs.filter((v) => v.visitType === 'appointment').length,
    waiting: tvs.filter((v) => v.status === 'waiting' || v.status === 'called').length,
    checkIns: tvs.length,
    completed: tvs.filter((v) => v.status === 'completed').length,
    collected: load()
      .payments.filter(
        (p) => p.facilityId === facilityId && p.createdAt.slice(0, 10) === day && p.status === 'success'
      )
      .reduce((s, p) => s + p.amount, 0),
    bookedToday: appts.filter((a) => a.status === 'booked' || a.status === 'arrived').length,
  };
}

function nextQueue(department: string): string {
  const state = load();
  const letter = (department || 'OPD').replace(/[^A-Za-z]/g, '').slice(0, 1).toUpperCase() || 'A';
  const key = letter;
  const n = (state.queueSeq[key] || 0) + 1;
  state.queueSeq[key] = n;
  save(state);
  return `${letter}-${String(n).padStart(3, '0')}`;
}

export function checkInPatient(input: {
  patient: FacilityPatient;
  facilityId: string;
  department: string;
  doctor: string;
  visitType: VisitType;
  reason?: string;
  paymentStatus: ReceptionVisit['paymentStatus'];
  amount?: number;
  appointmentTime?: string;
  appointmentId?: string;
}): ReceptionVisit {
  const state = load();
  const queueNumber = nextQueue(input.department);
  const visit: ReceptionVisit = {
    id: `V-${Date.now().toString(36).toUpperCase()}`,
    patientId: input.patient.id,
    hospitalNumber: input.patient.hospitalNumber,
    patientName: [input.patient.firstName, input.patient.lastName].filter(Boolean).join(' '),
    facilityId: input.facilityId,
    department: input.department,
    doctor: input.doctor,
    visitType: input.visitType,
    reason: input.reason,
    paymentStatus: input.paymentStatus,
    amount: input.amount,
    queueNumber,
    status: 'waiting',
    checkedInAt: new Date().toISOString(),
    estimatedWaitMin: 8 + Math.floor(Math.random() * 20),
    appointmentTime: input.appointmentTime,
    appointmentId: input.appointmentId,
    aiReminderSent: false,
  };
  state.visits = [visit, ...state.visits];
  if (input.appointmentId) {
    state.appointments = state.appointments.map((a) =>
      a.id === input.appointmentId ? { ...a, status: 'arrived' as const } : a
    );
  }
  save(state);
  return visit;
}

export function updateVisitStatus(visitId: string, status: QueueStatus) {
  const state = load();
  state.visits = state.visits.map((v) => (v.id === visitId ? { ...v, status } : v));
  save(state);
}

export function markAiReminder(visitId: string) {
  const state = load();
  state.visits = state.visits.map((v) =>
    v.id === visitId ? { ...v, aiReminderSent: true } : v
  );
  save(state);
}

export function bookAppointment(input: Omit<ReceptionAppointment, 'id' | 'createdAt' | 'status'>): ReceptionAppointment {
  const state = load();
  const appt: ReceptionAppointment = {
    ...input,
    id: `AP-${Date.now().toString(36).toUpperCase()}`,
    status: 'booked',
    createdAt: new Date().toISOString(),
  };
  state.appointments = [appt, ...state.appointments];
  save(state);
  return appt;
}

export function listAppointments(facilityId: string, day?: string): ReceptionAppointment[] {
  const d = day || new Date().toISOString().slice(0, 10);
  return load()
    .appointments.filter((a) => a.facilityId === facilityId && a.scheduledAt.slice(0, 10) === d)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export function cancelAppointment(id: string) {
  const state = load();
  state.appointments = state.appointments.map((a) =>
    a.id === id ? { ...a, status: 'cancelled' as const } : a
  );
  save(state);
}

export function recordPayment(input: Omit<ReceptionPayment, 'id' | 'createdAt' | 'status' | 'reference'> & { reference?: string }): ReceptionPayment {
  const state = load();
  const pay: ReceptionPayment = {
    ...input,
    id: `PAY-${Date.now().toString(36).toUpperCase()}`,
    reference: input.reference || `POS-${Date.now().toString(36).toUpperCase()}`,
    status: 'success',
    createdAt: new Date().toISOString(),
  };
  state.payments = [pay, ...state.payments];
  if (input.visitId) {
    state.visits = state.visits.map((v) =>
      v.id === input.visitId
        ? {
            ...v,
            paymentStatus: input.method === 'hmo' ? 'hmo' : input.method === 'waiver' ? 'waived' : 'paid',
            amount: input.amount,
          }
        : v
    );
  }
  save(state);
  return pay;
}

export function todayPayments(facilityId: string): ReceptionPayment[] {
  const day = new Date().toISOString().slice(0, 10);
  return load().payments.filter(
    (p) => p.facilityId === facilityId && p.createdAt.slice(0, 10) === day
  );
}

export function subscribeReceptionOps(cb: () => void): () => void {
  const fn = () => cb();
  window.addEventListener('medcore-reception-ops', fn);
  window.addEventListener('medcore-admin-sync', fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener('medcore-reception-ops', fn);
    window.removeEventListener('medcore-admin-sync', fn);
    window.removeEventListener('storage', fn);
  };
}

export function resetReceptionOps() {
  save({ visits: [], queueSeq: {}, appointments: [], payments: [] });
}
