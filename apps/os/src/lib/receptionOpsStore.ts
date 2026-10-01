/**
 * Reception operations — visits, queue, payments (facility-scoped, no demo seed).
 */
import { listPatients, type FacilityPatient } from './patientRegistryStore';

export const RECEPTION_OPS_KEY = 'medcore_os_reception_ops_v1';

export type QueueStatus = 'waiting' | 'called' | 'with_provider' | 'completed' | 'skipped';
export type VisitType = 'appointment' | 'walk_in' | 'follow_up' | 'emergency';

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
  paymentStatus: 'paid' | 'pending' | 'hmo' | 'waived';
  amount?: number;
  queueNumber: string;
  status: QueueStatus;
  checkedInAt: string;
  estimatedWaitMin?: number;
  appointmentTime?: string;
}

export interface ReceptionDayStats {
  patientsHandled: number;
  appointments: number;
  waiting: number;
  checkIns: number;
  collected: number;
}

interface OpsState {
  visits: ReceptionVisit[];
  queueSeq: Record<string, number>; // department prefix -> seq
}

function load(): OpsState {
  if (typeof window === 'undefined') return { visits: [], queueSeq: {} };
  try {
    const raw = localStorage.getItem(RECEPTION_OPS_KEY);
    if (!raw) return { visits: [], queueSeq: {} };
    const p = JSON.parse(raw);
    return { visits: Array.isArray(p.visits) ? p.visits : [], queueSeq: p.queueSeq || {} };
  } catch {
    return { visits: [], queueSeq: {} };
  }
}

function save(state: OpsState) {
  localStorage.setItem(RECEPTION_OPS_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('medcore-reception-ops', { detail: state }));
}

export function subscribeReceptionOps(cb: () => void) {
  const fn = () => cb();
  window.addEventListener('medcore-reception-ops', fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener('medcore-reception-ops', fn);
    window.removeEventListener('storage', fn);
  };
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
  return {
    patientsHandled: tvs.length,
    appointments: tvs.filter((v) => v.visitType === 'appointment').length,
    waiting: tvs.filter((v) => v.status === 'waiting' || v.status === 'called').length,
    checkIns: tvs.length,
    collected: tvs.filter((v) => v.paymentStatus === 'paid').reduce((s, v) => s + (v.amount || 0), 0),
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
    estimatedWaitMin: 12 + Math.floor(Math.random() * 15),
    appointmentTime: input.appointmentTime,
  };
  state.visits = [visit, ...state.visits];
  save(state);
  return visit;
}

export function updateVisitStatus(visitId: string, status: QueueStatus) {
  const state = load();
  state.visits = state.visits.map((v) => (v.id === visitId ? { ...v, status } : v));
  save(state);
}

export function resetReceptionOps() {
  save({ visits: [], queueSeq: {} });
}
